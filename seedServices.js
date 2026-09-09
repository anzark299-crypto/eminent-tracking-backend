require("dotenv").config();

const mongoose = require("mongoose");
const connectDatabase = require("./src/config/database");
const Service = require("./src/models/service");

const services = [
  "VMware Cloud Foundation (VCF) License Subscription",
  "IBM Power 9, SAN Switch & Flash System Warranty Renewal",
  "Cisco SAN Switches",
  "Power 9 Server",
  "Flash System Enclosure",
  "Support for DC and DR",
  "IBM POWER 9 SERVER REFURBISHED",
  "IBM Server AMC Renewal",
  "IBM Storage V5000",
  "IBM Storage V5000 Expansion",
  "IBM Switch SAN24B-4",
  "IBM Console",
  "IBM Backup TS3100",
  "IBM Server S822",
  "Suse Linux Enterprise Server license",
  "IBM Hardware Storage AMC Charge",
  "IBM WAS Reinstatement",
  "IBM MQ Reinstatement",
  "IBM WAS Renewal",
  "IBM MQ Adv Subscription & Support",
  "IBM MQ License + SW Subscription & Support",
  "IBM WAS SW Subscription & Support",
  "AMC for Fujitsu servers of ACL level-2 system",
  "PDS Server",
  "HMI Server Online",
  "HMI Server Backup",
  "Storage Server",
  "P/C Online Server",
  "P/C Backup Server",
  "SUSE Linux Enterprise Server/SUSE Enterprise Server",
  "NetApp FAS2720 Storage",
  "HP Server DL-380",
  "Power 10 Server for DC & DR",
  "netapp server AMC",
  "HP Tower Server, Windows Server Standard License, Server Installation",
  "Web Portal Application Development, Installation, Implementation & Training, Annual Maintenance & Training",
  "Server AMC - Operating System & Support",
];

const seedServices = async () => {
  try {
    await connectDatabase();

    // Prevent duplicate services if the script is accidentally run again
    for (const name of services) {
      await Service.updateOne(
        { name },
        {
          $setOnInsert: {
            name,
            status: "active",
          },
        },
        { upsert: true }
      );
    }

    console.log(`${services.length} service records processed successfully.`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Seed services error:", error.message);

    await mongoose.connection.close();
    process.exit(1);
  }
};

seedServices();