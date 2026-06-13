import { Router } from "express";
import { getCompanyByRecruiterId } from "../../controllers/companies/public.controller";

const router = Router();

router.get("/:recruiterId", getCompanyByRecruiterId);

export default router;
