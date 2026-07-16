-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'EMAIL_VERIFICATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);
