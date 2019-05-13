import express from 'express';
import * as datak from '../../controllers/api-v2/datak';

const router = express.Router();

router.route('/getDataBySearchTerm/:hablaUserId/:searchTerm/:caseInsensitive?/:andOperator?')
  .get(datak.getDataBySearchTerm);

export default router;
