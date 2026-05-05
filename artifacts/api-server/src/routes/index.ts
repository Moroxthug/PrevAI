import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quotesRouter from "./quotes";
import businessProfileRouter from "./business-profile";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quotesRouter);
router.use(businessProfileRouter);
router.use(paymentsRouter);

export default router;
