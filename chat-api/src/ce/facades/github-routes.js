import { Router } from 'express';

const router = Router();
router.use((_req, res) => {
    res.status(403).json({
        error: 'Not available in Community Edition',
        capability: 'github',
    });
});

export default router;
