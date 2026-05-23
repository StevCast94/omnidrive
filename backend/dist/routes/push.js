"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushRouter = void 0;
// ===== backend/src/routes/push.ts =====
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const push_1 = require("../services/push");
exports.pushRouter = (0, express_1.Router)();
// POST /api/push/subscribe
exports.pushRouter.post('/subscribe', auth_1.authenticate, async (req, res) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth)
        return res.status(400).json({ data: null, error: 'Invalid subscription object' });
    (0, push_1.storePushSub)(req.user.id, { endpoint, keys });
    return res.json({ data: { subscribed: true }, error: null });
});
// DELETE /api/push/subscribe
exports.pushRouter.delete('/subscribe', auth_1.authenticate, async (req, res) => {
    (0, push_1.removePushSub)(req.user.id);
    return res.json({ data: { unsubscribed: true }, error: null });
});
//# sourceMappingURL=push.js.map