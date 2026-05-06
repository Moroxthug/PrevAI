import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quotesRouter from "./quotes";
import businessProfileRouter from "./business-profile";
import paymentsRouter from "./payments";
import storageRouter from "./storage";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quotesRouter);
router.use(businessProfileRouter);
router.use(paymentsRouter);
router.use(storageRouter);
router.use(adminRouter);

export default router;
