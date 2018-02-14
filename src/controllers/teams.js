import httpStatus from 'http-status';
import APIError from '../helpers/APIError';
import { apiVersionedVisibility, publishByApiVersion } from '../helpers/publishedVisibility';
import * as teamSvc from '../services/teamService';
import {
   CannotDeactivateError,
   CannotInviteError,
   InvitationNotExistError,
   NoPermissionsError,
   NotActiveError,
   SubscriberOrgNotExistError,
   TeamExistsError,
   TeamNotExistError,
   UserNotExistError
} from '../services/errors';

export const getTeams = (req, res, next) => {
   const userId = req.user._id;
   const { subscriberOrgId } = req.query;

   teamSvc.getUserTeams(req, userId, subscriberOrgId)
      .then((teams) => {
         res.status(httpStatus.OK).json({ teams: publishByApiVersion(req, apiVersionedVisibility.publicTeams, teams) });
      })
      .catch((err) => {
         next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
      });
};

export const createTeam = (req, res, next) => {
   const userId = req.user._id;
   const subscriberOrgId = req.params.subscriberOrgId;

   teamSvc.createTeam(req, subscriberOrgId, req.body, userId)
      .then((createdTeam) => {
         res.status(httpStatus.CREATED).json(publishByApiVersion(req, apiVersionedVisibility.privateTeam, createdTeam));
      })
      .catch((err) => {
         if (err instanceof TeamExistsError) {
            res.status(httpStatus.CONFLICT).json({ status: 'EXISTS' });
         } else if (err instanceof NoPermissionsError) {
            res.status(httpStatus.FORBIDDEN).end();
         } else if (err instanceof SubscriberOrgNotExistError) {
            res.status(httpStatus.NOT_FOUND).end();
         } else if (err instanceof NotActiveError) {
            res.status(httpStatus.METHOD_NOT_ALLOWED).end();
         } else {
            next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
         }
      });
};

export const updateTeam = (req, res, next) => {
   const userId = req.user._id;
   const teamId = req.params.teamId;
   teamSvc.updateTeam(req, teamId, req.body, userId)
      .then(() => {
         res.status(httpStatus.NO_CONTENT).end();
      })
      .catch((err) => {
         if (err instanceof TeamNotExistError) {
            res.status(httpStatus.NOT_FOUND).end();
         } else if (err instanceof NoPermissionsError) {
            res.status(httpStatus.FORBIDDEN).end();
         } else if ((err instanceof TeamExistsError) || (err instanceof CannotDeactivateError)) {
            res.status(httpStatus.CONFLICT).end();
         } else {
            next(new APIError(err, httpStatus.SERVICE_UNAVAILABLE));
         }
      });
};

export const getTeamMembers = (req, res, next) => {
   const userId = req.user._id;
   const teamId = req.params.teamId;

   teamSvc.getTeamUsers(req, teamId, userId)
      .then((teamUsers) => {
         res.status(httpStatus.OK).json({ teamMembers: publishByApiVersion(req, apiVersionedVisibility.publicUsers, teamUsers) });
      })
      .catch((err) => {
         if (err instanceof TeamNotExistError) {
            res.status(httpStatus.NOT_FOUND).end();
         } else if (err instanceof NoPermissionsError) {
            res.status(httpStatus.FORBIDDEN).end();
         } else {
            next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
         }
      });
};

export const inviteMembers = (req, res, next) => {
   const userId = req.user._id;
   const teamId = req.params.teamId;

   teamSvc.inviteMembers(req, teamId, req.body.userIds, userId)
      .then(() => {
         res.status(httpStatus.ACCEPTED).end();
      })
      .catch((err) => {
         if ((err instanceof TeamNotExistError) || (err instanceof UserNotExistError)) {
            res.status(httpStatus.NOT_FOUND).end();
         } else if (err instanceof NoPermissionsError) {
            res.status(httpStatus.FORBIDDEN).end();
         } else if (err instanceof CannotInviteError) {
            res.status(httpStatus.METHOD_NOT_ALLOWED).end();
         } else {
            next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
         }
      });
};

export const replyToInvite = (req, res, next) => {
   const userId = req.user._id;
   const teamId = req.params.teamId;

   teamSvc.replyToInvite(req, teamId, req.body.accept, userId)
      .then(() => {
         res.status(httpStatus.OK).end();
      })
      .catch((err) => {
         if ((err instanceof TeamNotExistError) || (err instanceof UserNotExistError) || (err instanceof InvitationNotExistError)) {
            res.status(httpStatus.NOT_FOUND).end();
         } else if (err instanceof NoPermissionsError) {
            res.status(httpStatus.FORBIDDEN).end();
         } else {
            next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
         }
      });
};

