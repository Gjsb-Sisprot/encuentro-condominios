const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://djjuvkrhhgpbnokrafjw.supabase.co';
const supabaseKey = 'sb_publishable_fed-1yCE4ZEo5W10Mrcypw_PD7Z770A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('asistentes')
    .select('id, nombre, created_at, estado, es_acompanante');

  if (error) {
    console.error(error);
    return;
  }

  console.log('Total rows:', data.length);
  
  // Group by date of created_at
  const dates = {};
  data.forEach(d => {
    const dateStr = d.created_at ? d.created_at.substring(0, 10) : 'null';
    dates[dateStr] = (dates[dateStr] || 0) + 1;
  });
  console.log('Created at dates distribution:', dates);

  // Show details of rows created on May 28th
  const createdToday = data.filter(d => d.created_at && d.created_at.startsWith('2026-05-28'));
  console.log('Rows created today:', createdToday.length);
}

run();
