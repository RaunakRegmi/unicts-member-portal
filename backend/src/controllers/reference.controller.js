const prisma = require('../config/prisma');

// Nepal's administrative divisions: 7 provinces → 77 districts → 753 local
// levels, served to the frontend's cascading address dropdowns.
const nepalAddressData = require('../utils/nepal-address-data.json');

function addressData(req, res) {
  res.status(200).json({ success: true, data: nepalAddressData });
}

async function ictDomains(req, res, next) {
  try {
    const domains = await prisma.ictDomain.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ success: true, data: domains });
  } catch (err) {
    next(err);
  }
}

async function membershipGroups(req, res, next) {
  try {
    const groups = await prisma.membershipGroup.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
}

module.exports = { addressData, ictDomains, membershipGroups };
