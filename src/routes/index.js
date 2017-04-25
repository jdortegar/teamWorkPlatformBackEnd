//---------------------------------------------------------------------
// routes/index.js
//
// default route handler for hablaapi service
//---------------------------------------------------------------------
//  Date         Initials    Description
//  ----------   --------    ------------------------------------------
//  2017-02-02    RLA         Initial module creation
//
//---------------------------------------------------------------------

import express from 'express';
import authRoutes from './auth';
import conversationsRoutes from './conversations';
import messagingRoutes from './messaging';
import { containsAnyRole, containsRole, roles } from '../policies';
import subscriberOrgRoutes from './subscriberOrgs';
import teamsRoutes from './teams';
import teamRoomsRoutes from './teamRooms';
import userRoutes from './user';

const router = express.Router();


/** GET /test - Check service health */
router.get('/test', function(req, res) {
  const response = {
    status: 'SUCCESS'
  };
  res.json(response);
});

const isHablaUser = containsRole(roles.hablaUser);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/subscriberOrgs', subscriberOrgRoutes);
router.use('/teams', teamsRoutes);
router.use('/teamRooms', teamRoomsRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/messaging', messagingRoutes);

export default router;

