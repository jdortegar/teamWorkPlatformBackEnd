import httpStatus from 'http-status';
import APIError from '../helpers/APIError';
import { publicTeams, publicUsers } from '../helpers/publishedVisibility';
import teamSvc from '../services/teamService';
import { NoPermissionsError, TeamNotExistError } from '../services/errors';

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
