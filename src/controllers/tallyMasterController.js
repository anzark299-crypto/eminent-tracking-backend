const Customer = require("../models/customer");
const Distributor = require("../models/distributor");
const TallyPartyApproval = require("../models/tallyPartyApproval");

function clean(value) {
  if (
    value === undefined ||
    value === null ||
    value === "-"
  ) {
    return "";
  }

  return String(value).trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const number = Number(
    String(value).replace(/,/g, "")
  );

  return Number.isFinite(number)
    ? number
    : 0;
}


async function upsertTallyPartyApproval(party, detectedPartyType) {
  const tallyName = clean(
    party.tallyName || party.companyName || party.name
  );

  const tallyMasterId = clean(party.masterId);
  const tallySyncKey = clean(
    party.syncKey ||
    tallyName.toLowerCase().replace(/\s+/g, " ").trim()
  );

  if (!tallyName || !tallySyncKey) {
    return { saved: false, reason: "Missing Tally party name or sync key" };
  }

  const tallyCompany =
    clean(process.env.TALLY_COMPANY_NAME) ||
    "EMINENT INFOSOLUTION PVT.LTD";

  let approval = null;

  if (tallyMasterId) {
    approval = await TallyPartyApproval.findOne({
      tallyCompany,
      tallyMasterId,
    });
  }

  if (!approval) {
    const keyMatch = await TallyPartyApproval.findOne({
      tallyCompany,
      tallySyncKey,
    });

    // Never update a different Tally ledger just because its sync key matches.
    if (
      keyMatch &&
      tallyMasterId &&
      clean(keyMatch.tallyMasterId) &&
      clean(keyMatch.tallyMasterId).toLowerCase() !== tallyMasterId.toLowerCase()
    ) {
      return {
        saved: false,
        status: keyMatch.status,
        approvalId: keyMatch._id,
        reason: "Sync-key collision with a different Tally master ID; existing approval left unchanged",
      };
    }

    approval = keyMatch;
  }

  const partyDetails = {
    contactPerson: clean(party.contactPerson),
    email: clean(party.email),
    phone: clean(party.phone),
    mobile: clean(party.mobile),
    address: clean(party.address),
    addressLines: Array.isArray(party.addressLines) ? party.addressLines : [],
    city: clean(party.city),
    state: clean(party.state),
    pincode: clean(party.pincode || party.pinCode),
    country: clean(party.country),
    gstin: clean(party.gstin),
    gstRegistrationType: clean(party.gstRegistrationType),
    placeOfSupply: clean(party.placeOfSupply),
    pan: clean(party.pan),
    openingBalance: party.openingBalance,
    closingBalance: party.closingBalance,
    source: clean(party.source || "TallyPrime"),
    syncedAt: party.syncedAt || new Date(),
  };

  if (approval) {
    // Refresh ledger details but never reset its review status.
    const conflictingKey = await TallyPartyApproval.findOne({
      tallyCompany,
      tallySyncKey,
      _id: { $ne: approval._id },
    }).select("_id").lean();

    approval.tallyMasterId = tallyMasterId || approval.tallyMasterId;

    // Keep the current key if another approval already owns the incoming key.
    if (!conflictingKey) {
      approval.tallySyncKey = tallySyncKey;
    }

    approval.tallyAlterId = clean(party.alterId);
    approval.tallyName = tallyName;
    approval.companyName = clean(party.companyName || tallyName);
    approval.tallyParent = clean(party.parent);
    approval.detectedPartyType = detectedPartyType;
    approval.partyDetails = partyDetails;

    try {
      await approval.save();
    } catch (error) {
      if (error.code === 11000) {
        return {
          saved: false,
          status: approval.status,
          approvalId: approval._id,
          reason: "Duplicate approval key; existing review status preserved",
        };
      }
      throw error;
    }

    return {
      saved: true,
      status: approval.status,
      approvalId: approval._id,
      reason: conflictingKey ? "Existing sync key retained to prevent a duplicate" : undefined,
    };
  }

  try {
    approval = await TallyPartyApproval.create({
      tallyCompany,
      tallyMasterId,
      tallySyncKey,
      tallyAlterId: clean(party.alterId),
      tallyName,
      companyName: clean(party.companyName || tallyName),
      tallyParent: clean(party.parent),
      detectedPartyType,
      partyDetails,
      status: "pending",
    });

    return { saved: true, status: approval.status, approvalId: approval._id };
  } catch (error) {
    // A duplicate-key race should not break the entire master sync.
    if (error.code === 11000) {
      return { saved: false, reason: "Duplicate approval record detected" };
    }
    throw error;
  }
}
function buildTallyFields(party) {
  return {
    tallyName: clean(
      party.tallyName ||
        party.companyName
    ),

    tallySyncKey: clean(
      party.syncKey
    ),

    tallyAlterId: clean(
      party.alterId
    ),

    tallyMasterId: clean(
      party.masterId
    ),

    tallyParent: clean(
      party.parent
    ),

    tallyCompanyName: clean(
      party.companyName
    ),

    tallyContactPerson: clean(
      party.contactPerson
    ),

    tallyEmail: clean(
      party.email
    ),

    tallyPhone: clean(
      party.phone
    ),

    tallyMobile: clean(
      party.mobile
    ),

    tallyAddress: clean(
      party.address
    ),

    tallyAddressLines:
      Array.isArray(
        party.addressLines
      )
        ? party.addressLines
            .map(clean)
            .filter(Boolean)
        : [],

    tallyCity: clean(
      party.city
    ),

    tallyState: clean(
      party.state
    ),

    tallyPincode: clean(
      party.pincode ||
        party.pinCode
    ),

    tallyCountry: clean(
      party.country
    ),

    tallyGstin: clean(
      party.gstin
    ),

    tallyGstRegistrationType:
      clean(
        party.gstRegistrationType
      ),

    tallyPlaceOfSupply: clean(
      party.placeOfSupply
    ),

    tallyPan: clean(
      party.pan
    ),

    tallyOpeningBalance:
      toNumber(
        party.openingBalance
      ),

    tallyClosingBalance:
      toNumber(
        party.closingBalance
      ),

    tallySource: clean(
      party.source
    ) || "TallyPrime",

    tallyLastSyncedAt:
      new Date(),
  };
}

function getRequestedName(party) {
  return clean(
    party.requestedName ||
      party.companyName ||
      party.tallyName ||
      party.name
  );
}

function findPartyDocument(
  documents,
  party
) {
  const requestedName =
    normalize(
      getRequestedName(party)
    );

  const tallyName =
    normalize(
      party.tallyName
    );

  const syncKey =
    normalize(
      party.syncKey
    );

  return documents.find(
    (doc) => {
      const companyName =
        normalize(
          doc.companyName
        );

      const docTallyName =
        normalize(
          doc.tallyName
        );

      const docSyncKey =
        normalize(
          doc.tallySyncKey
        );

      return (
        (requestedName &&
          companyName ===
            requestedName) ||

        (tallyName &&
          docTallyName ===
            tallyName) ||

        (syncKey &&
          docSyncKey ===
            syncKey)
      );
    }
  );
}

// ============================================================
// SYNC TALLY MASTER DATA
// ============================================================

const syncTallyMasters =
  async (req, res) => {
    try {
      const secret =
        process.env.TALLY_SYNC_SECRET;

      if (
        secret &&
        req.headers[
          "x-tally-sync-secret"
        ] !== secret
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid Tally sync secret",
        });
      }

      const {
        customers = [],
        distributors = [],
        discoveredLedgers = [],
      } = req.body || {};

      if (
        !Array.isArray(customers) ||
        !Array.isArray(distributors) ||
        !Array.isArray(discoveredLedgers)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "customers, distributors and discoveredLedgers must be arrays",
        });
      }

      // ------------------------------------------------------
      // Load existing parties
      // ------------------------------------------------------

      const [
        existingCustomers,
        existingDistributors,
      ] = await Promise.all([
        Customer.find({}),
        Distributor.find({}),
      ]);

      let customersUpdated = 0;
      let customersCreated = 0;

      let distributorsUpdated = 0;
      let distributorsCreated = 0;

      const skippedCustomers = [];
      const skippedDistributors = [];

      let discoveryQueued = 0;
      let discoveryRefreshed = 0;
      const skippedDiscovery = [];
      const seenDiscoveryIds = new Set();
      const seenDiscoveryKeys = new Set();

      // ------------------------------------------------------
      // CUSTOMERS
      // ------------------------------------------------------

      for (
        const party of customers
      ) {
        const requestedName =
          getRequestedName(party);

        if (!requestedName) {
          skippedCustomers.push({
            reason:
              "Missing customer name",
            party,
          });

          continue;
        }

        let customer =
          findPartyDocument(
            existingCustomers,
            party
          );

        const tallyFields =
          buildTallyFields(
            party
          );

        if (customer) {
          // ----------------------------------------------
          // IMPORTANT:
          // Only Tally-owned fields are updated here.
          //
          // Existing operational fields such as:
          // startDate, endDate, services, etc.
          // are NOT touched.
          // ----------------------------------------------

          Object.assign(
            customer,
            tallyFields
          );

          // Keep the app's existing
          // company name unless it is empty.
          if (
            !clean(
              customer.companyName
            )
          ) {
            customer.companyName =
              requestedName;
          }

          await customer.save();

          customersUpdated++;        } else {
          // ------------------------------------------------
          // SERVER-SIDE SAFETY GUARD
          //
          // Tally master sync may UPDATE an existing
          // customer, but it may NEVER CREATE a new
          // customer. The confirmed-party registry
          // decides which parties are allowed into
          // the application.
          // ------------------------------------------------

          const approvalResult = await upsertTallyPartyApproval(
            party,
            "customer"
          );

          skippedCustomers.push({
            reason: approvalResult.saved
              ? "Awaiting approval"
              : (approvalResult.reason || "Approval request was not saved"),
            party,
            approvalStatus: approvalResult.status || null,
            approvalId: approvalResult.approvalId || null,
          });

          continue;
        }
      }

      // ------------------------------------------------------
      // DISTRIBUTORS
      // ------------------------------------------------------

      for (
        const party of distributors
      ) {
        const requestedName =
          getRequestedName(party);

        if (!requestedName) {
          skippedDistributors.push({
            reason:
              "Missing distributor name",
            party,
          });

          continue;
        }

        let distributor =
          findPartyDocument(
            existingDistributors,
            party
          );

        const tallyFields =
          buildTallyFields(
            party
          );

        if (distributor) {
          // ----------------------------------------------
          // Update only Tally-owned fields.
          // Existing distributor service/payment
          // information is preserved.
          // ----------------------------------------------

          Object.assign(
            distributor,
            tallyFields
          );

          if (
            !clean(
              distributor.companyName
            )
          ) {
            distributor.companyName =
              requestedName;
          }

          // Update basic fields only
          // when Tally actually provides them.
          if (
            clean(party.contactPerson)
          ) {
            distributor.contactPerson =
              clean(
                party.contactPerson
              );
          }

          if (clean(party.email)) {
            distributor.email =
              clean(party.email);
          }

          if (clean(party.phone)) {
            distributor.phone =
              clean(party.phone);
          }

          if (clean(party.address)) {
            distributor.address =
              clean(party.address);
          }

          if (clean(party.city)) {
            distributor.city =
              clean(party.city);
          }

          if (clean(party.state)) {
            distributor.state =
              clean(party.state);
          }

          if (
            clean(
              party.pincode ||
                party.pinCode
            )
          ) {
            distributor.pincode =
              clean(
                party.pincode ||
                  party.pinCode
              );
          }

          if (clean(party.gstin)) {
            distributor.gstin =
              clean(party.gstin);
          }

          await distributor.save();

          distributorsUpdated++;        } else {
          // ------------------------------------------------
          // SERVER-SIDE SAFETY GUARD
          //
          // Tally master sync may UPDATE an existing
          // distributor, but it may NEVER CREATE a new
          // distributor. The confirmed-party registry
          // decides which parties are allowed into
          // the application.
          // ------------------------------------------------

          const approvalResult = await upsertTallyPartyApproval(
            party,
            "distributor"
          );

          skippedDistributors.push({
            reason: approvalResult.saved
              ? "Awaiting approval"
              : (approvalResult.reason || "Approval request was not saved"),
            party,
            approvalStatus: approvalResult.status || null,
            approvalId: approvalResult.approvalId || null,
          });

          continue;
        }
      }

      // ------------------------------------------------------
      // DISCOVERED TALLY LEDGERS
      //
      // Discovery candidates are review-only. This loop never
      // creates Customer or Distributor documents.
      // ------------------------------------------------------

      const tallyCompany =
        clean(process.env.TALLY_COMPANY_NAME) ||
        "EMINENT INFOSOLUTION PVT.LTD";

      const allConfirmedParties = [
        ...existingCustomers,
        ...existingDistributors,
      ];

      for (const party of discoveredLedgers) {
        const detectedType = String(
          party.partyType || party.detectedPartyType || ""
        ).trim().toLowerCase();

        if (!["customer", "distributor"].includes(detectedType)) {
          skippedDiscovery.push({
            reason: "Candidate is not classified as customer or distributor",
            party,
          });
          continue;
        }

        const tallyName = clean(
          party.tallyName || party.companyName || party.name
        );

        const masterId = clean(
          party.masterId || party.tallyMasterId
        );

        const syncKey = clean(
          party.syncKey || party.tallySyncKey
        );

        if (!tallyName || (!masterId && !syncKey)) {
          skippedDiscovery.push({
            reason: "Missing Tally name and/or stable identifier",
            party,
          });
          continue;
        }

        const normalizedId = masterId.toLowerCase();
        const normalizedKey = syncKey.toLowerCase();

        if (
          (normalizedId && seenDiscoveryIds.has(normalizedId)) ||
          (normalizedKey && seenDiscoveryKeys.has(normalizedKey))
        ) {
          skippedDiscovery.push({
            reason: "Duplicate candidate within this sync payload",
            party,
          });
          continue;
        }

        if (normalizedId) seenDiscoveryIds.add(normalizedId);
        if (normalizedKey) seenDiscoveryKeys.add(normalizedKey);

        // Suppress candidates already represented by a confirmed
        // party. A conflicting pair of Tally master IDs is never
        // treated as a match solely because names/keys look alike.
        const confirmedMatch = allConfirmedParties.find((existing) => {
          const existingId = clean(existing.tallyMasterId).toLowerCase();
          const existingKey = clean(existing.tallySyncKey).toLowerCase();

          // Master IDs are authoritative when both records have one.
          // A mismatch must never fall through to a name/key match.
          if (normalizedId && existingId) {
            return normalizedId === existingId;
          }

          // Use the stable sync key when available on both records.
          if (normalizedKey && existingKey) {
            return normalizedKey === existingKey;
          }

          // Only fall back to a name when neither record has a stable
          // identifier. This avoids suppressing distinct Tally ledgers
          // merely because their names are the same.
          if (
            !normalizedId &&
            !existingId &&
            !normalizedKey &&
            !existingKey
          ) {
            const existingName = normalize(
              existing.tallyName || existing.companyName || existing.name || ""
            );
            const candidateName = normalize(tallyName);
            return Boolean(candidateName && existingName === candidateName);
          }

          return false;
        });

        if (confirmedMatch) {
          skippedDiscovery.push({
            reason: "Already represented by a confirmed customer/distributor",
            party,
          });
          continue;
        }

        // Find existing approval records by stable ID first, then
        // by sync key. Never let a key collision overwrite a different
        // Tally master ID.
        const existingApprovalById = masterId
          ? await TallyPartyApproval.findOne({
              tallyCompany,
              tallyMasterId: masterId,
            })
          : null;

        const existingApprovalByKey = syncKey
          ? await TallyPartyApproval.findOne({
              tallyCompany,
              tallySyncKey: syncKey,
            })
          : null;

        if (
          !existingApprovalById &&
          existingApprovalByKey &&
          masterId &&
          clean(existingApprovalByKey.tallyMasterId) &&
          clean(existingApprovalByKey.tallyMasterId) !== masterId
        ) {
          skippedDiscovery.push({
            reason: "Sync-key collision with a different Tally master ID; existing approval left unchanged",
            party,
          });
          continue;
        }

        const hadApproval = Boolean(
          existingApprovalById || existingApprovalByKey
        );

        const approvalResult = await upsertTallyPartyApproval(
          {
            ...party,
            tallyName,
            masterId,
            syncKey,
            companyName: party.companyName || tallyName,
          },
          detectedType
        );

        if (approvalResult.saved) {
          if (hadApproval) {
            discoveryRefreshed++;
          } else {
            discoveryQueued++;
          }
        } else {
          skippedDiscovery.push({
            reason: approvalResult.reason || "Approval record was not saved",
            party,
            approvalStatus: approvalResult.status || null,
            approvalId: approvalResult.approvalId || null,
          });
        }
      }

      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Tally master data synchronized successfully",

        syncedAt:
          new Date().toISOString(),

        summary: {
          customersReceived:
            customers.length,

          customersCreated,

          customersUpdated,

          distributorsReceived:
            distributors.length,

          distributorsCreated,

          distributorsUpdated,

          discoveryReceived:
            discoveredLedgers.length,

          discoveryQueued,

          discoveryRefreshed,

          discoverySkipped:
            skippedDiscovery.length,

          totalProcessed:
            customers.length +
            distributors.length,
        },

        skipped: {
          customers:
            skippedCustomers,

          distributors:
            skippedDistributors,

          discoveredLedgers:
            skippedDiscovery,
        },
      });
    } catch (error) {
      console.error(
        "Tally master sync error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to synchronize Tally master data",
        error:
          error.message,
      });
    }
  };

module.exports = {
  syncTallyMasters,
};



