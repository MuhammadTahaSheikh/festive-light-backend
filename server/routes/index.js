import { Router } from 'express';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import placesRoutes from './places.js';
import renderRoutes from './render.js';
import { leadRouter, leadsRouter } from './leads.js';
import quotesRoutes from './quotes.js';
import campaignsRoutes from './campaigns.js';
import discoveryRoutes from './discovery.js';
import creditsRoutes from './credits.js';
import templatesRoutes from './templates.js';
import mailRoutes from './mail.js';

const api = Router();

api.use(healthRoutes);
api.use('/auth', authRoutes);
api.use('/places', placesRoutes);
api.use('/render', renderRoutes);
api.use('/lead', leadRouter);
api.use('/leads', leadsRouter);
api.use(quotesRoutes);
api.use('/campaigns', campaignsRoutes);
api.use('/discovery', discoveryRoutes);
api.use('/credits', creditsRoutes);
api.use('/templates', templatesRoutes);
api.use('/mail', mailRoutes);

export default api;
