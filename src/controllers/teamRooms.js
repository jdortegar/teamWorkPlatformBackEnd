import httpStatus from 'http-status';
import APIError from '../helpers/APIError';
import teamRoomSvc, { TeamRoomNotExistError } from '../services/teamRoomService';
import { NoPermissionsError } from '../services/teamService';
import { publicTeamRooms, publicUsers } from './publicData';

export function getTeamRooms(req, res, next) {
   const userId = req.user._id;

   teamRoomSvc.getUserTeamRooms(req, userId)
      .then((teamRooms) => {
         res.status(httpStatus.OK).json({ teamRooms: publicTeamRooms(teamRooms) });
      })
      .catch((err) => {
         console.error(err);
         return next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
      });
}

export function getTeamRoomMembers(req, res, next) {
   const userId = req.user._id;
   const teamRoomId = req.params.teamRoomId;

   teamRoomSvc.getTeamRoomUsers(req, teamRoomId, userId)
      .then((teamRoomUsers) => {
         res.status(httpStatus.OK).json({ teamRoomMembers: publicUsers(teamRoomUsers) });
      })
      .catch((err) => {
         if (err instanceof TeamRoomNotExistError) {
            res.status(httpStatus.NOT_FOUND).end();
         } else if (err instanceof NoPermissionsError) {
            res.status(httpStatus.FORBIDDEN).end();
         } else {
            next(new APIError(err, httpStatus.INTERNAL_SERVER_ERROR));
         }
      });
}
