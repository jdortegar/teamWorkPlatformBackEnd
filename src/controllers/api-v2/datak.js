import httpStatus from 'http-status';
import * as datakSvc from '../../services/datakService';

export const getDataBySearchTerm = async (req, res) => {
    const { neo4jSession } = req.app.locals;
    const hablaUserId = req.params.hablaUserId;
    const searchTerm = req.params.searchTerm;
    const caseInsensitive = req.params.caseInsensitive || 1;
    const andOperator = req.params.andOperator || 0;

    console.log("hablaUserId="+hablaUserId);
    console.log("searchTerm=" +searchTerm);

    var data = null;

    if (hablaUserId !== null && searchTerm !== null) {
        data = await datakSvc.getDataBySearchTerm(neo4jSession, hablaUserId, searchTerm, caseInsensitive, andOperator);
    } else {
        if (hablaUserId == null) {
            console.error("hablaUserId is null ");
        } else {
           console.error("searchTeam is null");
        }
    }

    return res.status(httpStatus.OK).json({
       message: {
          data,
       }
    });
 };
