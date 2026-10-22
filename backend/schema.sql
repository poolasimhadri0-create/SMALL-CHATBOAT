-- Database Creation Script for AI Chatbot Backend
-- Supports utf8mb4 for full emoji and international text support

CREATE DATABASE IF NOT EXISTS `gemini_chatbot_db` 
    DEFAULT CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE `gemini_chatbot_db`;

-- Conversations table
CREATE TABLE IF NOT EXISTS `conversations` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages table
CREATE TABLE IF NOT EXISTS `messages` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `conversation_id` CHAR(36) NOT NULL,
    `role` ENUM('user', 'model') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `image_path` VARCHAR(500) DEFAULT NULL,
    `sources` JSON DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_messages_conversation`
        FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`)
        ON DELETE CASCADE,
    INDEX `idx_messages_conversation_created` (`conversation_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
