import express from 'express';
import ckgRoutes from './ckg';
import surveyRoutes from './survey';
import integrationsV2Routes from './integrations';
import teamRoutes from './teams';
import organization from './organization';

const router = express.Router();

router.use('/ckg', ckgRoutes);
router.use(organization);
router.use(surveyRoutes);
router.use(integrationsV2Routes);
router.use(teamRoutes);

export default router;