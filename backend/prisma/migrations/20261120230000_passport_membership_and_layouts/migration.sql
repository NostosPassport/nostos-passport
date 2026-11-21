-- A stamp can leave the main passport without being removed, and each book keeps its own stamp placement.
ALTER TABLE "photo" ADD COLUMN "in_passport" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "photo" ADD COLUMN "layout_x" DOUBLE PRECISION;
ALTER TABLE "photo" ADD COLUMN "layout_y" DOUBLE PRECISION;
ALTER TABLE "photo" ADD COLUMN "layout_scale" DOUBLE PRECISION;
ALTER TABLE "photo" ADD COLUMN "layout_rotation" DOUBLE PRECISION;

ALTER TABLE "collection_stamp" ADD COLUMN "x" DOUBLE PRECISION;
ALTER TABLE "collection_stamp" ADD COLUMN "y" DOUBLE PRECISION;
ALTER TABLE "collection_stamp" ADD COLUMN "scale" DOUBLE PRECISION;
ALTER TABLE "collection_stamp" ADD COLUMN "rotation" DOUBLE PRECISION;
