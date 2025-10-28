import type { Express } from "express";
import { storage } from "../storage";
import { insertLiveShowSchema } from "@shared/schema";

export function registerShowRoutes(app: Express) {
  // Live Shows
  app.get("/api/shows", async (_req, res) => {
    try {
      const shows = await storage.getLiveShows();
      res.json(shows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch live shows" });
    }
  });

  app.post("/api/shows", async (req, res) => {
    try {
      const showData = insertLiveShowSchema.parse(req.body);
      const show = await storage.createLiveShow(showData);
      res.status(201).json(show);
    } catch (error) {
      res.status(400).json({ error: "Invalid show data" });
    }
  });

  app.patch("/api/shows/:id", async (req, res) => {
    try {
      const show = await storage.updateLiveShow(req.params.id, req.body);
      if (!show) {
        return res.status(404).json({ error: "Show not found" });
      }
      res.json(show);
    } catch (error) {
      res.status(500).json({ error: "Failed to update show" });
    }
  });
}