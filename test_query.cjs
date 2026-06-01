const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("Deleting applications...");
  const { error } = await supabase
    .from("seller_applications")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all
  
  if (error) {
    console.error("Delete Error:", error);
  } else {
    console.log("Successfully deleted applications.");
  }
}

run();
