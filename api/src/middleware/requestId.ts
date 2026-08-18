import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

// Attach a stable id to every request and echo it back on the response so a
// single request can be correlated across structured logs and clients
// (FFSCRUM-20). An incoming x-request-id is honoured when present and sane;
// otherwise we mint one.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length > 0 && incoming.length <= 200 ? incoming : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
