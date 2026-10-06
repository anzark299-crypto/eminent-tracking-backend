const Distributor = require("../models/distributor");
const TallyTransaction = require("../models/tallyTransaction");
const Payment = require("../models/payment");

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getCurrentFinancialYearStart() {
  const now = new Date();

  const year =
    now.getMonth() >= 3
      ? now.getFullYear()
      : now.getFullYear() - 1;

  return new Date(year, 3, 1, 0, 0, 0, 0);
}

async function getDistributorAccountSummary(req, res) {
  try {
    const distributorId = req.params.distributorId;

    const distributor = await Distributor.findById(distributorId).lean();

    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found",
      });
    }

    const financialYearStart =
      getCurrentFinancialYearStart();

    const now = new Date();

    const openingBalance =
      Math.max(
        0,
        toNumber(distributor.tallyOpeningBalance)
      );

    const purchaseTransactions =
      await TallyTransaction.find({
        distributor: distributorId,
        partyType: "distributor",
        transactionType: "purchase",
        isCancelled: false,
        transactionDate: {
          $gte: financialYearStart,
          $lte: now,
        },
      })
        .select(
          "transactionDate voucherNumber totalAmount"
        )
        .sort({
          transactionDate: 1,
        })
        .lean();

    const currentPeriodPurchaseTotal =
      purchaseTransactions.reduce(
        (total, transaction) =>
          total + Math.max(
            0,
            toNumber(transaction.totalAmount)
          ),
        0
      );

    const payments =
      await Payment.find({
        distributor: distributorId,
        partyType: "distributor",
        paymentType: "distributor_payment",
        source: "TallyPrime",
        isCancelled: false,
      })
        .select(
          "paymentDate voucherNumber amount"
        )
        .sort({
          paymentDate: 1,
        })
        .lean();

    const totalPayments =
      payments.reduce(
        (total, payment) =>
          total + Math.max(
            0,
            toNumber(payment.amount)
          ),
        0
      );

    const totalPayable =
      openingBalance +
      currentPeriodPurchaseTotal;

    const outstanding =
      Math.max(
        0,
        totalPayable - totalPayments
      );

    return res.status(200).json({
      success: true,

      summary: {
        distributorId,

        financialYearStart:
          financialYearStart.toISOString(),

        asOf:
          now.toISOString(),

        openingBalance,

        currentPeriodPurchaseTotal,

        currentPeriodPurchaseCount:
          purchaseTransactions.length,

        totalPayable,

        totalPayments,

        paymentCount:
          payments.length,

        outstanding,
      },
    });
  } catch (error) {
    console.error(
      "Distributor accounting summary error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to calculate distributor account summary",
      error: error.message,
    });
  }
}

module.exports = {
  getDistributorAccountSummary,
};
