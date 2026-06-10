import { Router } from "express";
import {
  getCandidateProfile,
  updateCandidateProfile,
  uploadAvatar,
} from "../../controllers/users/candidate.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { validate } from "../../middleware/validate";
import { updateCandidateProfileSchema } from "../../validations/users/profile.validation";

const router = Router();
const candidateOnly = [authenticate, authorize("candidate")];

router.get("/candidate/profile", candidateOnly, getCandidateProfile);

router.put(
  "/candidate/profile",
  candidateOnly,
  validate(updateCandidateProfileSchema),
  updateCandidateProfile,
);

router.post(
  "/candidate/avatar",
  candidateOnly,
  upload.single("avatar"),
  uploadAvatar,
);

export default router;
