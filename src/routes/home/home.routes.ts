import { Router } from "express";
import { getHomeContent } from "../../controllers/home/home.controller";

const router = Router();

router.get("/", getHomeContent);

export default router;
