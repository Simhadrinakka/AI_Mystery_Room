import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
export async function requireAuth(req, res, next) {
  try { const token = req.cookies?.token; if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } }); const { userId } = jwt.verify(token, env.JWT_SECRET); req.user = await User.findById(userId).select('_id name email'); if (!req.user) throw new Error('User not found'); next(); }
  catch { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in again.' } }); }
}
