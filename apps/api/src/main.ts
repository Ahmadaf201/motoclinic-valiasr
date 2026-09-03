import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "motoclinic-api",
    version: "0.1.0"
  });
});

app.get("/api", (_req, res) => {
  res.json({
    name: "موتو کلینیک ولیعصر(عج)",
    message: "سیستم مدیریت هوشمند تعمیرگاه موتورسیکلت"
  });
});

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`MotoClinic API running on port ${PORT}`);
});
