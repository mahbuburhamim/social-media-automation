const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const pureBengaliLaundryRules = [
  {
    keyword: 'price',
    replyType: 'both',
    replyContent: 'হ্যালো {name}! আমাদের ওয়াশ ও আয়রন ১০ টাকা থেকে শুরু। রেট চার্ট দেখতে ভিজিট করুন: https://laundrybondhu.com/pricing 🧺',
    matchType: 'contains'
  },
  {
    keyword: 'দাম',
    replyType: 'both',
    replyContent: 'হ্যালো {name}! আমাদের ওয়াশ ও আয়রন ১০ টাকা থেকে শুরু। রেট চার্ট দেখতে ভিজিট করুন: https://laundrybondhu.com/pricing 🧺',
    matchType: 'contains'
  },
  {
    keyword: 'rate',
    replyType: 'both',
    replyContent: 'হ্যালো {name}! আমাদের ওয়াশ ও আয়রন ১০ টাকা থেকে শুরু। রেট চার্ট দেখতে ভিজিট করুন: https://laundrybondhu.com/pricing 🧺',
    matchType: 'contains'
  },
  {
    keyword: 'pickup',
    replyType: 'both',
    replyContent: 'হ্যালো {name}! আমরা ফ্রি হোম পিকআপ এবং ডেলিভারি দিয়ে থাকি। অর্ডার করতে ভিজিট করুন: https://laundrybondhu.com অথবা আপনার ঠিকানা ও ফোন নম্বর দিন। 🚚',
    matchType: 'contains'
  },
  {
    keyword: 'পিকআপ',
    replyType: 'both',
    replyContent: 'হ্যালো {name}! আমরা ফ্রি হোম পিকআপ এবং ডেলিভারি দিয়ে থাকি। অর্ডার করতে ভিজিট করুন: https://laundrybondhu.com অথবা আপনার ঠিকানা ও ফোন নম্বর দিন। 🚚',
    matchType: 'contains'
  },
  {
    keyword: 'delivery',
    replyType: 'both',
    replyContent: 'হ্যালো {name}! আমরা ফ্রি হোম পিকআপ এবং ডেলিভারি দিয়ে থাকি। অর্ডার করতে ভিজিট করুন: https://laundrybondhu.com অথবা আপনার ঠিকানা ও ফোন নম্বর দিন। 🚚',
    matchType: 'contains'
  },
  {
    keyword: 'location',
    replyType: 'both',
    replyContent: 'আমাদের প্রধান সার্ভিস এরিয়া রংপুর সিটি। আপনার ঘরের কাপড় আমরা বাসা থেকে নিয়ে ধুয়ে আবার আপনার বাসায় পৌঁছে দেবো! 📍',
    matchType: 'contains'
  },
  {
    keyword: 'ঠিকানা',
    replyType: 'both',
    replyContent: 'আমাদের প্রধান সার্ভিস এরিয়া রংপুর সিটি। আপনার ঘরের কাপড় আমরা বাসা থেকে নিয়ে ধুয়ে আবার আপনার বাসায় পৌঁছে দেবো! 📍',
    matchType: 'contains'
  },
  {
    keyword: 'phone',
    replyType: 'both',
    replyContent: 'আমাদের সাথে সরাসরি কথা বলতে কল করুন 01410330940 📞',
    matchType: 'contains'
  },
  {
    keyword: 'নম্বর',
    replyType: 'both',
    replyContent: 'আমাদের সাথে সরাসরি কথা বলতে কল করুন 01410330940 📞',
    matchType: 'contains'
  }
];

async function insertRules() {
  console.log('--- Re-inserting Pure Bengali Laundry Bondhu Rules into Supabase ---');
  try {
    // Delete existing rules
    await prisma.autoReplyRule.deleteMany({});
    console.log('Cleared existing rules.');

    // Insert customized rules
    const createdCount = await prisma.autoReplyRule.createMany({
      data: pureBengaliLaundryRules
    });
    console.log(`Successfully updated database with ${createdCount.count} pure Bengali rules!`);
  } catch (error) {
    console.error('Failed to update rules:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

insertRules();
