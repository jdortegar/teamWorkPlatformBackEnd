import _ from 'lodash';
import axios from 'axios';
import config from '../config/env'
import { IntegrationAccessError, SubscriberOrgNotExistError } from './errors';
import { composeAuthorizationUrl, exchangeAuthorizationCodeForAccessToken, getUserInfo, revokeIntegration } from '../integrations/onedrive';
import { integrationsUpdated } from './messaging';
import * as subscriberUsersTable from '../repositories/db/subscriberUsersTable';

const defaultExpiration = 5 * 60; // 5 minutes.

export const hashKey = (state) => {
    return `${state}#onedriveIntegrationState`;
};

const deduceState = (req) => {
    let ipAddress = req.headers['x-forwarded-for'] || '127.0.0.1';
    const ipAddresses = ipAddress.split(', ');
    ipAddress = (ipAddresses.length > 1) ? ipAddresses[0] : ipAddress;
    const userAgent = req.headers['user-agent'];
    return `${ipAddress}_${userAgent}`;
};

const createRedisOnedriveIntegrationState = async (req, userId, subscriberId, teamLevel) => {
    try {
        const state = deduceState(req);
        const subscriberField = (teamLevel == 1) ? 'teamId' : 'subscriberOrgId';
        await req.app.locals.redis.setAsync(`${hashKey(state)}#teamLevel`, teamLevel, 'EX', defaultExpiration);
        await req.app.locals.redis.hmsetAsync(hashKey(state), 'userId', userId, subscriberField, subscriberId, 'EX', defaultExpiration);
        return state;
    } catch (err) {
        return Promise.reject(err);
    }
    // return new Promise((resolve, reject) => {
    //     const state = deduceState(req);
    //     req.app.locals.redis.hmsetAsync(hashKey(state),
    //         'userId', userId,
    //         'subscriberOrgId', subscriberOrgId,
    //         'EX', defaultExpiration)
    //         .then(() => resolve(state))
    //         .catch(err => reject(err));
    // });
};

const deleteRedisOnedriveIntegrationState = async (req, teamLevel) => {
    try {
        const subscriberField = (teamLevel == 1) ? 'teamId' : 'subscriberOrgId';
        const state = deduceState(req)
        const redisResponse = await req.app.locals.redis.hmgetAsync(hashKey(state), 'userId', subscriberField);
        console.log('*** REDIS RESPONSE** ', redisResponse, subscriberField, state,);
        const userId = redisResponse[0];
        const subscriberId = redisResponse[1];
        if (userId === null || subscriberId === null) {
            throw new IntegrationAccessError('No Oauth 2 state found.');
        }
        await Promise.all([
            req.app.locals.redis.delAsync(hashKey(state)),
            req.app.locals.redis.delAsync(`${hashKey(state)}#teamLevel`)
        ]);
        const result = { userId };
        result[subscriberField] = subscriberId;
        return result;
    } catch (err) {
        return Promise.reject(err);
    }
    // return new Promise((resolve, reject) => {
    //     const state = deduceState(req);
    //     let userId;
    //     let subscriberOrgId;

    //     req.app.locals.redis.hmgetAsync(hashKey(state), 'userId', 'subscriberOrgId')
    //         .then((redisResponse) => {
    //             userId = redisResponse[0];
    //             subscriberOrgId = redisResponse[1];
    //             if ((userId === null) || (subscriberOrgId === null)) {
    //                 throw new IntegrationAccessError('No OAuth 2 state found.');
    //             }

    //             return req.app.locals.redis.delAsync(hashKey(state));
    //         })
    //         .then(() => {
    //             resolve({ userId, subscriberOrgId });
    //         })
    //         .catch((err) => {
    //             req.logger.debug('AD: redis get failed');
    //             req.logger.error(err);
    //             reject(err);
    //         });
    // });
};


export const integrateOnedrive = async (req, userId, subscriberId) => {
    try {
        let subscriber;
        const teamLevelVal = req.query.teamLevel || 0;
        if (typeof req.query.teamLevel !== 'undefined' && req.query.teamLevel == 1) {
            subscriber = await teamMembersTable.getTeamMemberByTeamIdAndUserId(req, subscriberId, userId);
        } else {
            subscriber = await subscriberUsersTable.getSubscriberUserByUserIdAndSubscriberOrgId(req, userId, subscriberId);
        }
        if (!subscriber) {
            throw new SubscriberOrgNotExistError(subscriberId);
        }
        await createRedisOnedriveIntegrationState(req, userId, subscriberId, teamLevelVal);
        return composeAuthorizationUrl();
    } catch (err) {
        return Promise.reject(err);
    }
    // return new Promise((resolve, reject) => {
    //     subscriberUsersTable.getSubscriberUserByUserIdAndSubscriberOrgId(req, userId, subscriberOrgId)
    //         .then((subscriberUser) => {
    //             if (!subscriberUser) {
    //                 throw new SubscriberOrgNotExistError(subscriberOrgId);
    //             }

    //             return createRedisOnedriveIntegrationState(req, userId, subscriberOrgId);
    //         })
    //         .then(() => {
    //             const onedriveUri = composeAuthorizationUrl();
    //             resolve(onedriveUri);
    //         })
    //         .catch(err => reject(err));
    // });
};

export const onedriveAccessResponse = async (req, { code, error, error_description }) => {
    try {
        if (error) {
            throw new IntegrationAccessError(error);
        }
        const teamLevelVal = await req.app.locals.redis.getAsync(`${hashKey(deduceState(req))}#teamLevel`) || 0;
        const teamLevel = teamLevelVal == 1;
        const integrationContext = await deleteRedisOnedriveIntegrationState(req, teamLevelVal);
        const userId = integrationContext.userId;
        const subscriberId = (typeof integrationContext.subscriberOrgId !== 'undefined') ? integrationContext.subscriberOrgId : integrationContext.teamId;
        const tokenInfo = await exchangeAuthorizationCodeForAccessToken(req, code);
        req.logger.debug(`OneDrive access info for userId=${userId} = ${JSON.stringify(tokenInfo)}`);
        let subscriber;
        if (teamLevel) {
            subscriber = await teamMembersTable.getTeamMemberByTeamIdAndUserId(req, subscriberId, userId);
        } else {
            subscriber = await subscriberUsersTable.getSubscriberUserByUserIdAndSubscriberOrgId(req, userId, subscriberId);
        }
        const userInfo = await getUserInfo(req, tokenInfo.access_token);
        if (!subscriber) {
            throw new SubscriberOrgNotExistError(subscriberId);
        }
        tokenInfo.userId =  userInfo.id;
        tokenInfo.expired = false;
        const onedriveInfo = {
            onedrive: tokenInfo
        };
        const updateInfo = _.merge(subscriber, { integrations: onedriveInfo });
        delete updateInfo.integrations.onedrive.revoked;
        const integrations = updateInfo.integrations;
        if (teamLevel) {
            await teamMembersTable.updateTeamMembersIntegrations(req, userId, subscriberId, integrations);
    
        } else {
            await subscriberUsersTable.updateSubscriberUserIntegrations(req, subscriber.subscriberUserId, integrations);
        }
        integrationsUpdated(req, updateInfo);
        return subscriberId;
    } catch (err) {
        console.log(err);
        return Promise.reject(err);
    }
    // return new Promise((resolve, reject) => {
    //     let integrationInfo;
    //     let userId;
    //     let subscriberOrgId;
    //     let updateInfo;

    //     deleteRedisOnedriveIntegrationState(req)
    //         .then((integrationContext) => {
    //             userId = integrationContext.userId;
    //             subscriberOrgId = integrationContext.subscriberOrgId;

    //             if (error) {
    //                 throw new IntegrationAccessError(`${error}: ${error_description}`); // eslint-disable-line camelcase
    //             }

    //             return exchangeAuthorizationCodeForAccessToken(req, code);
    //         })
    //         .then((tokenInfo) => {
    //             req.logger.debug(`OneDrive access info for userId=${userId}/subscriberOrgId=${subscriberOrgId} = ${JSON.stringify(tokenInfo)}`);
    //             integrationInfo = tokenInfo;
    //             return Promise.all([
    //                 subscriberUsersTable.getSubscriberUserByUserIdAndSubscriberOrgId(req, userId, subscriberOrgId),
    //                 getUserInfo(req, integrationInfo.access_token)
    //             ]);
    //         })
    //         .then(([subscriberUser, userInfo]) => {
    //             if (!subscriberUser) {
    //                 throw new SubscriberOrgNotExistError(subscriberOrgId);
    //             }

    //             const subscriberUserId = subscriberUser.subscriberUserId;
    //             integrationInfo.userId = userInfo.id;
    //             integrationInfo.expired = false;
    //             const onedriveInfo = {
    //                 onedrive: integrationInfo
    //             };
    //             updateInfo = _.merge(subscriberUser, { integrations: onedriveInfo });
    //             delete updateInfo.integrations.onedrive.revoked;
    //             const integrations = updateInfo.integrations;
    //             return subscriberUsersTable.updateSubscriberUserIntegrations(req, subscriberUserId, integrations);
    //         })
    //         .then(() => {
    //             integrationsUpdated(req, updateInfo);
    //             resolve(subscriberOrgId);
    //         })
    //         .catch((err) => {
    //             let integrationError;
    //             if (err instanceof IntegrationAccessError) {
    //                 integrationError = err;
    //             } else {
    //                 integrationError = new IntegrationAccessError();
    //                 integrationError._chainedError = err;
    //             }

    //             integrationError.subscriberOrgId = subscriberOrgId;
    //             reject(integrationError);
    //         });
    // });
};

export const revokeOnedrive = async (req, userId, subscriberId) => {
    try {
        const teamLevel = typeof req.query.teamLevel !== 'undefined' && req.query.teamLevel == 1;
        userId = req.query.userId || userId;
        let subscriber;
    
        if (teamLevel) {
    
            subscriber = await teamMembersTable.getTeamMemberByTeamIdAndUserId(req, subscriberId, userId);
    
        }  else {
            subscriber = await subscriberUsersTable.getSubscriberUserByUserIdAndSubscriberOrgId(req, userId, subscriberId);
        }
        if (!subscriber) {
            throw new SubscriberOrgNotExistError(subscriberId);
        }
        const { integrations } = subscriber;
        const userAccessToken = (subscriber.integrations && subscriber.integrations.onedrive) ? 
            subscriber.integrations.onedrive.access_token : undefined;
        if (!userAccessToken) {
            throw new IntegrationAccessError('Onedrive integration deoesn\'t exist.');
        }
        integrations.onedrive = { revoked: true };
        let subscriberInfo;
        const revokeData = {
            subscriberOrgId: subscriber.subscriberOrgId,
            hablaUserId: userId,
            source: 'onedrive',
            subscriberUserId: null,
            teamId: null
        };
    
        if (teamLevel) {
            revokeData.teamId = subscriber.teamId;
            subscriberInfo = teamMembersTable.updateTeamMembersIntegrations(req, userId, subscriberId, integrations);
        } else {
            revokeData.subscriberUserId = subscriber.subscriberUserId;
            subscriberInfo = await subscriberUsersTable.updateSubscriberUserIntegrations(req, subscriber.subscriberUserId, integrations);
        }
        await axios.post(`${config.knowledgeApiEndpoint}/revoke/user`, revokeData);
        await revokeIntegration(req, userAccessToken);
        integrationsUpdated(req, subscriberInfo);
    } catch (err) {
        console.log(err);
        return Promise.reject(err);
    }
};
