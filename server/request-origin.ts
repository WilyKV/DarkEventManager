import type { RequestHandler } from "express";

export const protectApiOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.get("origin");
  const fetchSite = req.get("sec-fetch-site");
  const currentOrigin = `${req.protocol}://${req.get("host")}`;
  if ((fetchSite === "cross-site" || fetchSite === "same-site") || (origin && origin !== currentOrigin)) {
    res.status(403).json({ message: "Origine de la requête non autorisée" });
    return;
  }

  next();
};
