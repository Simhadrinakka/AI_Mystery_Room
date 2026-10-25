import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../schemas/api.schemas.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', maxAge: 7 * 86400000, path: '/' };
function setToken(res, user) { res.cookie('token', jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN }), cookieOptions); }
router.post('/register', validate(registerSchema), async (req, res, next) => { try { if (await User.exists({ email: req.body.email })) return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } }); const user = await User.create({ name: req.body.name, email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12) }); setToken(res, user); res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } }); } catch (e) { next(e); } });
router.post('/login', validate(loginSchema), async (req, res, next) => { try { const user = await User.findOne({ email: req.body.email }); if (!user || !await bcrypt.compare(req.body.password, user.passwordHash)) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } }); setToken(res, user); res.json({ user: { id: user.id, name: user.name, email: user.email } }); } catch (e) { next(e); } });
router.post('/logout', requireAuth, (req, res) => { res.clearCookie('token', { ...cookieOptions, maxAge: undefined }); res.json({ ok: true }); });
router.get('/me', requireAuth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } }));
export default router;
