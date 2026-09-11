// FILE: src/routes/whatsappAgentRoutes.js
// NEW FILE — Feature: WhatsApp Automation (agent-only routes)
// Mounted at /api/agent/whatsapp in server.js as a completely separate
// mount from /api/admin, so nothing here can ever collide with or affect
// existing admin/driver routes.

const express = require("express");
const router = express.Router();
const { protectAgent } = require("../middleware/auth");
const agentController = require("../controllers/whatsappAgentController");

router.get("/next-job", protectAgent, agentController.getNextJob);
router.get("/invoices/:id/download", protectAgent, agentController.downloadForAgent);
router.post("/jobs/:runId/complete", protectAgent, agentController.completeJob);

module.exports = router;