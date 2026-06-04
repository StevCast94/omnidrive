"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedRouter = void 0;
const express_1 = require("express");
const seed_1 = require("../../prisma/seed");
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.seedRouter = (0, express_1.Router)();
// GET /api/seed — ejecutar seed data
exports.seedRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    await (0, seed_1.prisma)();
    return res.json({ data: { seeded: true }, error: null });
}));
//# sourceMappingURL=seed.js.map