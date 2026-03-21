import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import campaignsRouter from "./campaigns";
import charactersRouter from "./characters";
import sessionsRouter from "./sessions";
import mapsRouter from "./maps";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(campaignsRouter);
router.use(charactersRouter);
router.use(sessionsRouter);
router.use(mapsRouter);
router.use(messagesRouter);

export default router;
