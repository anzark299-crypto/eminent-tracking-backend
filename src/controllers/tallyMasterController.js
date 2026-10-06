const Customer = require("../models/customer");
const Distributor = require("../models/distributor");

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
      } = req.body || {};

      if (
        !Array.isArray(customers) ||
        !Array.isArray(distributors)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "customers and distributors must be arrays",
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

          skippedCustomers.push({
            reason:
              "Customer not found. New customer creation is disabled.",
            party,
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

          skippedDistributors.push({
            reason:
              "Distributor not found. New distributor creation is disabled.",
            party,
          });

          continue;
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

          totalProcessed:
            customers.length +
            distributors.length,
        },

        skipped: {
          customers:
            skippedCustomers,

          distributors:
            skippedDistributors,
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
