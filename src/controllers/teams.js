import httpStatus from 'http-status';
import APIError from '../helpers/APIError';
import teamSvc from '../services/teamService';

export function getTeams(req, res, next) {
   const userId = req.user._id;

   teamSvc.getUserTeams(req, userId)
      .then((teams) => {
         res.status(httpStatus.OK).json({ teams: teams });
      })
      .catch((err) => {
         console.error(err);
         return next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
      });
}
