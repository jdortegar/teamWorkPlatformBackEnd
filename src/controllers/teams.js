import httpStatus from 'http-status';
import APIError from '../helpers/APIError';
import { privateTeam, publicTeams, publicUsers } from '../helpers/publishedVisibility';
import teamSvc from '../services/teamService';
import { NoPermissionsError, TeamExistsError, TeamNotExistError } from '../services/errors';

export function getTeams(req, res, next) {
   const userId = req.user._id;
   const { subscriberOrgId } = req.query;

   teamSvc.getUserTeams(req, userId, subscriberOrgId)
      .then((teams) => {
         res.status(httpStatus.OK).json({ teams: publicTeams(teams) });
      })
      .catch((err) => {
         console.error(err);
         next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
      });
}

export function createTeam(req, res, next) {
   const userId = req.user._id;
   const subscriberOrgId = req.params.subscriberOrgId;

   teamSvc.createTeam(req, subscriberOrgId, req.body, userId)
      .then((createdTeam) => {
         res.status(httpStatus.CREATED).json(privateTeam(createdTeam));
      })
      .catch((err) => {
         if (err instanceof TeamExistsError) {
            res.status(httpStatus.CONFLICT).json({ status: 'EXISTS' });
         } else if (err instanceof NoPermissionsError) {
            res.status(httpStatus.FORBIDDEN).end();
         } else {
            next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
         }
      });
}

export function updateTeam(req, res, next) {
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
         } else {
            next(new APIError(err, httpStatus.SERVICE_UNAVAILABLE));
         }
      });
}

export function getTeamMembers(req, res, next) {
   const userId = req.user._id;
   const teamId = req.params.teamId;

   teamSvc.getTeamUsers(req, teamId, userId)
      .then((teamUsers) => {
         res.status(httpStatus.OK).json({ teamMembers: publicUsers(teamUsers) });
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
}
