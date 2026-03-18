import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Default arms to initialize
const DEFAULT_ARMS = [
  // Diagnosis suggestions
  { armKey: "diagnosis-hypertension", armType: "diagnosis", category: "Hypertension" },
  { armKey: "diagnosis-diabetes", armType: "diagnosis", category: "Diabetes" },
  { armKey: "diagnosis-respiratory", armType: "diagnosis", category: "Respiratory Infection" },
  { armKey: "diagnosis-cardiac", armType: "diagnosis", category: "Cardiac Conditions" },
  { armKey: "diagnosis-gastro", armType: "diagnosis", category: "Gastrointestinal" },
  { armKey: "diagnosis-musculoskeletal", armType: "diagnosis", category: "Musculoskeletal" },
  
  // Treatment suggestions
  { armKey: "treatment-medication", armType: "treatment", category: "Medication" },
  { armKey: "treatment-lifestyle", armType: "treatment", category: "Lifestyle Changes" },
  { armKey: "treatment-referral", armType: "treatment", category: "Referral" },
  { armKey: "treatment-monitoring", armType: "treatment", category: "Monitoring" },
  
  // Medication suggestions
  { armKey: "medication-antihypertensive", armType: "medication", category: "Antihypertensive" },
  { armKey: "medication-antibiotic", armType: "medication", category: "Antibiotic" },
  { armKey: "medication-analgesic", armType: "medication", category: "Analgesic" },
  { armKey: "medication-antidiabetic", armType: "medication", category: "Antidiabetic" },
  
  // Documentation suggestions
  { armKey: "documentation-soap", armType: "documentation", category: "SOAP Notes" },
  { armKey: "documentation-discharge", armType: "documentation", category: "Discharge Summary" },
  { armKey: "documentation-referral", armType: "documentation", category: "Referral Letter" },
  
  // Clinical decision support
  { armKey: "cds-drug-interaction", armType: "cds", category: "Drug Interaction Alert" },
  { armKey: "cds-allergy-alert", armType: "cds", category: "Allergy Alert" },
  { armKey: "cds-lab-interpretation", armType: "cds", category: "Lab Interpretation" },
  { armKey: "cds-preventive-care", armType: "cds", category: "Preventive Care" },
];

// GET /api/rl/stats - Get RL statistics
export async function GET() {
  try {
    // Check if any arms exist
    const armCount = await db.rLArm.count();

    if (armCount === 0) {
      return NextResponse.json({
        success: false,
        error: "RL system not initialized",
      });
    }

    // Get all arms with their stats
    const arms = await db.rLArm.findMany({
      where: { isActive: true },
      orderBy: { qValue: "desc" },
    });

    // Get total feedback count
    const totalFeedback = await db.rLFeedback.count();

    // Calculate overall stats
    const overallAcceptance = arms.length > 0
      ? arms.reduce((sum, arm) => sum + arm.acceptanceRate, 0) / arms.length
      : 0;

    const overallHelpful = arms.length > 0
      ? arms.reduce((sum, arm) => sum + arm.averageReward, 0) / arms.length
      : 0;

    // Get recent accuracy (last 100 feedbacks)
    const recentFeedbacks = await db.rLFeedback.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    const recentAccuracy = recentFeedbacks.length > 0
      ? recentFeedbacks.reduce((sum, f) => sum + f.reward, 0) / recentFeedbacks.length
      : 0;

    // Top performers (by Q-value)
    const topPerformers = arms
      .filter((arm) => arm.totalPulls >= 3)
      .slice(0, 5)
      .map((arm) => ({
        id: arm.id,
        armKey: arm.armKey,
        armType: arm.armType,
        category: arm.category,
        totalPulls: arm.totalPulls,
        qValue: arm.qValue,
        averageReward: arm.averageReward,
      }));

    // Needs exploration (low pull count)
    const needsExploration = arms
      .filter((arm) => arm.totalPulls < 5)
      .slice(0, 5)
      .map((arm) => ({
        id: arm.id,
        armKey: arm.armKey,
        armType: arm.armType,
        category: arm.category,
        totalPulls: arm.totalPulls,
      }));

    return NextResponse.json({
      success: true,
      data: {
        totalFeedback,
        overallAcceptance,
        overallHelpful,
        recentAccuracy,
        arms: arms.map((arm) => ({
          id: arm.id,
          armKey: arm.armKey,
          armType: arm.armType,
          category: arm.category,
          totalPulls: arm.totalPulls,
          averageReward: arm.averageReward,
          qValue: arm.qValue,
          acceptanceRate: arm.acceptanceRate,
          avgRating: arm.avgRating,
          alpha: arm.alpha,
          beta: arm.beta,
        })),
        topPerformers,
        needsExploration,
      },
    });
  } catch (error) {
    console.error("Failed to get RL stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get RL statistics" },
      { status: 500 }
    );
  }
}

// POST /api/rl/stats - Initialize RL system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body || {};

    if (action === "init" || !action) {
      // Check if already initialized
      const existingCount = await db.rLArm.count();
      if (existingCount > 0) {
        // Return existing stats
        const arms = await db.rLArm.findMany({
          where: { isActive: true },
          orderBy: { qValue: "desc" },
        });

        return NextResponse.json({
          success: true,
          data: {
            totalFeedback: await db.rLFeedback.count(),
            overallAcceptance: 0,
            overallHelpful: 0,
            recentAccuracy: 0,
            arms: arms.map((arm) => ({
              id: arm.id,
              armKey: arm.armKey,
              armType: arm.armType,
              category: arm.category,
              totalPulls: arm.totalPulls,
              averageReward: arm.averageReward,
              qValue: arm.qValue,
              acceptanceRate: arm.acceptanceRate,
              avgRating: arm.avgRating,
              alpha: arm.alpha,
              beta: arm.beta,
            })),
            topPerformers: [],
            needsExploration: arms.slice(0, 5).map((arm) => ({
              id: arm.id,
              armKey: arm.armKey,
              armType: arm.armType,
              category: arm.category,
              totalPulls: arm.totalPulls,
            })),
          },
        });
      }

      // Create default arms
      await db.rLArm.createMany({
        data: DEFAULT_ARMS.map((arm) => ({
          armKey: arm.armKey,
          armType: arm.armType,
          category: arm.category,
          qValue: 0.5,
          alpha: 1.0,
          beta: 1.0,
        })),
      });

      const arms = await db.rLArm.findMany({
        where: { isActive: true },
        orderBy: { qValue: "desc" },
      });

      return NextResponse.json({
        success: true,
        data: {
          totalFeedback: 0,
          overallAcceptance: 0,
          overallHelpful: 0,
          recentAccuracy: 0,
          arms: arms.map((arm) => ({
            id: arm.id,
            armKey: arm.armKey,
            armType: arm.armType,
            category: arm.category,
            totalPulls: arm.totalPulls,
            averageReward: arm.averageReward,
            qValue: arm.qValue,
            acceptanceRate: arm.acceptanceRate,
            avgRating: arm.avgRating,
            alpha: arm.alpha,
            beta: arm.beta,
          })),
          topPerformers: [],
          needsExploration: arms.slice(0, 5).map((arm) => ({
            id: arm.id,
            armKey: arm.armKey,
            armType: arm.armType,
            category: arm.category,
            totalPulls: arm.totalPulls,
          })),
        },
      });
    }

    if (action === "feedback") {
      const { armKey, feedbackType, rating, context, suggestionType, suggestionText, sessionId, userId } = body;

      if (!armKey || !feedbackType) {
        return NextResponse.json(
          { success: false, error: "armKey and feedbackType are required" },
          { status: 400 }
        );
      }

      // Find the arm
      const arm = await db.rLArm.findUnique({
        where: { armKey },
      });

      if (!arm) {
        return NextResponse.json(
          { success: false, error: "Arm not found" },
          { status: 404 }
        );
      }

      // Calculate reward
      let reward = 0;
      switch (feedbackType) {
        case "accept":
          reward = 1.0;
          break;
        case "reject":
          reward = 0.0;
          break;
        case "helpful":
          reward = 0.8;
          break;
        case "not-helpful":
          reward = 0.2;
          break;
        case "rating":
          // Normalize 1-5 rating to 0-1
          reward = rating ? (rating - 1) / 4 : 0.5;
          break;
        default:
          reward = 0.5;
      }

      // Create feedback record
      await db.rLFeedback.create({
        data: {
          armId: arm.id,
          feedbackType,
          rating: rating || null,
          reward,
          context: context ? JSON.stringify(context) : null,
          suggestionType,
          suggestionText,
          sessionId,
          userId,
        },
      });

      // Update arm statistics using Q-learning update
      const newTotalPulls = arm.totalPulls + 1;
      const newTotalRewards = arm.totalRewards + reward;
      const newAverageReward = newTotalRewards / newTotalPulls;

      // Q-learning update: Q(s,a) = Q(s,a) + α * (r - Q(s,a))
      const learningRate = 0.1;
      const newQValue = arm.qValue + learningRate * (reward - arm.qValue);

      // Thompson Sampling update (Beta distribution)
      let newAlpha = arm.alpha;
      let newBeta = arm.beta;
      if (reward >= 0.5) {
        newAlpha = arm.alpha + 1;
      } else {
        newBeta = arm.beta + 1;
      }

      // Acceptance metrics
      let newAcceptCount = arm.acceptCount;
      let newRejectCount = arm.rejectCount;
      if (feedbackType === "accept") newAcceptCount++;
      if (feedbackType === "reject") newRejectCount++;
      const newAcceptanceRate = newTotalPulls > 0 ? newAcceptCount / newTotalPulls : 0;

      // Rating metrics
      let newTotalRatings = arm.totalRatings;
      let newRatingSum = arm.ratingSum;
      let newAvgRating = arm.avgRating;
      if (feedbackType === "rating" && rating) {
        newTotalRatings++;
        newRatingSum += rating;
        newAvgRating = newRatingSum / newTotalRatings;
      }

      // Update arm
      await db.rLArm.update({
        where: { id: arm.id },
        data: {
          totalPulls: newTotalPulls,
          totalRewards: newTotalRewards,
          averageReward: newAverageReward,
          qValue: newQValue,
          alpha: newAlpha,
          beta: newBeta,
          acceptCount: newAcceptCount,
          rejectCount: newRejectCount,
          acceptanceRate: newAcceptanceRate,
          totalRatings: newTotalRatings,
          ratingSum: newRatingSum,
          avgRating: newAvgRating,
          lastUpdated: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          armKey,
          feedbackType,
          reward,
          newQValue,
          updated: true,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("RL POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process RL request" },
      { status: 500 }
    );
  }
}
