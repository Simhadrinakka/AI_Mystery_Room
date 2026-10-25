import { Router } from 'express';
import Case from '../models/Case.js';
import { toPublicCase } from '../utils/serializers.js';
const router = Router();
router.get('/', async (req, res, next) => { try { const c = await Case.findOne({ isDemo: true, status: 'ready' }); if (!c) return res.status(404).json({ error: { code: 'DEMO_MISSING', message: 'Demo case has not been seeded yet.' } }); res.json(toPublicCase(c)); } catch (e) { next(e); } });
export default router;
