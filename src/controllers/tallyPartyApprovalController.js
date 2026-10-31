const mongoose = require("mongoose");
const Customer = require("../models/customer");
const Distributor = require("../models/distributor");
const TallyPartyApproval = require("../models/tallyPartyApproval");

function clean(value) {
  if (value === undefined || value === null || value === "-") return "";
  return String(value).trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function getTallyFields(approval) {
  const d = approval.partyDetails || {};
  const name = clean(approval.tallyName || approval.companyName);
  return {
    tallyPartyName: name,
    tallyName: name,
    tallyCompanyName: clean(approval.tallyCompany),
    tallySyncKey: clean(approval.tallySyncKey),
    tallyMasterId: clean(approval.tallyMasterId),
    tallyAlterId: clean(approval.tallyAlterId),
    tallyParent: clean(approval.tallyParent),
    tallyContactPerson: clean(d.contactPerson),
    tallyEmail: clean(d.email),
    tallyPhone: clean(d.phone),
    tallyMobile: clean(d.mobile),
    tallyAddress: clean(d.address),
    tallyAddressLines: Array.isArray(d.addressLines) ? d.addressLines : [],
    tallyCity: clean(d.city),
    tallyState: clean(d.state),
    tallyPincode: clean(d.pincode || d.pinCode),
    tallyCountry: clean(d.country),
    tallyGstin: clean(d.gstin),
    tallyGstRegistrationType: clean(d.gstRegistrationType),
    tallyPlaceOfSupply: clean(d.placeOfSupply),
    tallyPan: clean(d.pan),
    tallyOpeningBalance: Number(d.openingBalance) || 0,
    tallyClosingBalance: Number(d.closingBalance) || 0,
    tallySource: clean(d.source || "TallyPrime"),
    tallyLastSyncedAt: d.syncedAt ? new Date(d.syncedAt) : new Date(),
  };
}

async function findExisting(Model, approval) {
  // Prefer stable Tally identifiers. Never select a record for modification
  // based only on a potentially shared party name.
  if (approval.tallyMasterId) {
    const byMasterId = await Model.findOne({
      tallyMasterId: approval.tallyMasterId,
    });
    if (byMasterId) return byMasterId;
  }

  if (approval.tallySyncKey) {
    const bySyncKey = await Model.findOne({
      tallySyncKey: approval.tallySyncKey,
    });
    if (bySyncKey) return bySyncKey;
  }

  return null;
}

async function listPending(req, res) {
  try {
    const items = await TallyPartyApproval.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ success: true, count: items.length, items });
  } catch (error) {
    console.error("List Tally party approvals error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load pending approvals." });
  }
}

async function approveParty(req, res) {
  let createdParty = null;

  try {
    const type = clean(req.body && req.body.type).toLowerCase();
    if (!["customer", "distributor"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be customer or distributor." });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid approval ID." });
    }

    const approval = await TallyPartyApproval.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ success: false, message: "Approval request not found." });
    }

    if (approval.status === "declined") {
      return res.status(409).json({ success: false, message: "This party was declined and cannot be approved." });
    }

    if (approval.status === "approved") {
      if (String(approval.approvedAs) !== type) {
        return res.status(409).json({ success: false, message: "This party was already approved as a different type." });
      }
      const Model = type === "customer" ? Customer : Distributor;
      const linked = approval.linkedPartyId
        ? await Model.findById(approval.linkedPartyId)
        : null;
      return res.json({ success: true, message: "Party is already approved.", party: linked, approval });
    }

    const name = clean(approval.companyName || approval.tallyName);
    if (!name) {
      return res.status(400).json({ success: false, message: "The Tally party has no usable name." });
    }

    const SelectedModel = type === "customer" ? Customer : Distributor;
    const OtherModel = type === "customer" ? Distributor : Customer;

    const existingSelected = await findExisting(SelectedModel, approval);
    const existingOther = await findExisting(OtherModel, approval);

    // If identifiers do not match, a same-name record is ambiguous.
    // Block approval instead of updating or duplicating that record.
    const nameCandidates = [
      { companyName: { $regex: "^" + clean(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } },
      { tallyName: { $regex: "^" + clean(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } },
      { tallyPartyName: { $regex: "^" + clean(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" } },
    ];

    const sameNameSelected = existingSelected ? null : await SelectedModel.findOne({
      $or: nameCandidates,
    }).select("_id companyName tallyName tallyPartyName").lean();

    const sameNameOther = existingOther ? null : await OtherModel.findOne({
      $or: nameCandidates,
    }).select("_id companyName tallyName tallyPartyName").lean();

    if (sameNameSelected || sameNameOther) {
      return res.status(409).json({
        success: false,
        message: "A party with the same name already exists but its Tally identifiers do not match. Review the existing record manually before approving.",
      });
    }

    if (existingOther) {
      return res.status(409).json({
        success: false,
        message: "A matching party already exists under the other party type. Resolve the existing record first.",
      });
    }

    const tallyFields = getTallyFields(approval);
    const details = approval.partyDetails || {};
    let party = existingSelected;

    if (party) {
      // Update Tally-owned fields only; preserve operational fields and relationships.
      Object.assign(party, tallyFields);
      if (!clean(party.companyName)) party.companyName = name;
      await party.save();
    } else {
      const fields = {
        companyName: name,
        contactPerson: clean(details.contactPerson),
        email: clean(details.email).toLowerCase(),
        phone: clean(details.phone || details.mobile),
        address: clean(details.address),
        city: clean(details.city),
        state: clean(details.state),
        pincode: clean(details.pincode || details.pinCode),
        gstin: clean(details.gstin).toUpperCase(),
        source: "TallyPrime",
        ...tallyFields,
      };

      // Service dates and all other business relationships are left at model defaults.
      party = await SelectedModel.create(fields);
      createdParty = party;
    }

    approval.status = "approved";
    approval.approvedAs = type;
    approval.reviewedBy = req.user.userId;
    approval.reviewedAt = new Date();
    approval.linkedPartyId = party._id;
    await approval.save();

    return res.json({
      success: true,
      message: `Tally party approved as ${type}.`,
      party,
      approval,
    });
  } catch (error) {
    // Best-effort cleanup if approval saving failed after a new record was created.
    if (createdParty && createdParty._id) {
      try {
        await createdParty.deleteOne();
      } catch (cleanupError) {
        console.error("Approval rollback cleanup failed:", cleanupError.message);
      }
    }

    console.error("Approve Tally party error:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A matching Tally party already exists. Refresh and review the existing record." });
    }
    return res.status(500).json({ success: false, message: "Unable to approve this Tally party." });
  }
}

async function declineParty(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid approval ID." });
    }

    const approval = await TallyPartyApproval.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ success: false, message: "Approval request not found." });
    }

    if (approval.status === "approved") {
      return res.status(409).json({ success: false, message: "An approved party cannot be declined." });
    }

    if (approval.status === "declined") {
      return res.json({ success: true, message: "Party is already declined.", approval });
    }

    approval.status = "declined";
    approval.approvedAs = null;
    approval.reviewedBy = req.user.userId;
    approval.reviewedAt = new Date();
    await approval.save();

    return res.json({ success: true, message: "Tally party declined.", approval });
  } catch (error) {
    console.error("Decline Tally party error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to decline this Tally party." });
  }
}

module.exports = { listPending, approveParty, declineParty };


