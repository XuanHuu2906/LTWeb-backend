import { Router } from "express";
import {
  getHomeContent,
  getTestimonials,
} from "../../controllers/home/home.controller";

const router = Router();

router.get("/", getHomeContent);
router.get("/testimonials", getTestimonials);

export default router;
