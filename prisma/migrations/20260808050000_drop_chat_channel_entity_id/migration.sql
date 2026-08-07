-- Drop the write-only ChatChannel.entityId column.
-- It was only ever set (channel-creation helpers), never read; the linked
-- entity is already encoded in the channel id prefix (WO_/TEAM_/DIRECT_).
ALTER TABLE "chat_channels" DROP COLUMN "entityId";
