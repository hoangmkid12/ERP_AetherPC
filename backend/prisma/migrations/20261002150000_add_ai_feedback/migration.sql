-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" VARCHAR(50) NOT NULL,
    "chat_log_id" VARCHAR(50),
    "user_id" VARCHAR(50),
    "user_name" VARCHAR(150),
    "user_role" VARCHAR(50),
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "rating" VARCHAR(30) NOT NULL,
    "correction" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RECORDED',
    "reviewed_by_id" VARCHAR(50),
    "reviewed_by_name" VARCHAR(150),
    "knowledge_document_id" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_feedback_status_created_at_idx" ON "ai_feedback"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_feedback_user_id_chat_log_id_idx" ON "ai_feedback"("user_id", "chat_log_id");
