function v(id){
  return (document.getElementById(id)?.value || "").trim();
}
function selectedRadio(name){
  return document.querySelector('input[name="'+name+'"]:checked')?.value || "";
}
function selectedChecks(name){
  return [...document.querySelectorAll('input[name="'+name+'"]:checked')].map(x=>x.value).join(", ");
}
function line(label, value){
  return value ? label + ": " + value + "\n" : "";
}
function buildSummary(){
  let out = "CHILD-DIRECTED APP / WEBSITE DISCOVERY BRIEF\n\n";
  out += line("Starting direction", selectedRadio("direction"));
  out += line("Big idea", v("bigIdea"));

  out += "\nFIRST CREATION\n";
  out += line("Name", v("thingName"));
  out += line("Type", v("thingType"));
  out += line("Appearance", v("appearance"));
  out += line("Special feature / ability", v("special"));
  out += line("Where it belongs", v("home"));

  out += "\nCORE EXPERIENCE\n";
  out += line("What the user does", v("playerDoes"));
  out += line("Goal", v("goal"));
  out += line("Challenge", v("challenge"));
  out += line("Success / reward", v("reward"));

  out += "\nSTYLE & WORLD\n";
  out += line("World", v("world"));
  out += line("Tone", v("funny"));
  out += line("Difficulty", v("difficulty"));
  out += line("Sounds", v("sounds"));
  out += line("Must-have feature", v("mustHave"));

  out += "\nLEARNING\n";
  out += line("Possible learning themes", selectedChecks("learning"));
  out += line("Learning idea", v("learningIdea"));

  out += "\nRAW CHILD INPUT\n";
  out += line("Exact quotes", v("quotes"));
  out += line("Other observations / ideas", v("extra"));

  out += "\nBUILD GUARDRAILS\n";
  out += "- Child directs the concept; adult operates the computer.\n";
  out += "- Original characters and world only; do not copy copyrighted IP.\n";
  out += "- Prefer offline drawing and invention before screen interaction.\n";
  out += "- No adverts, social mechanics, loot boxes, streaks or endless-play loops.\n";
  out += "- First version should be extremely small and testable.\n";
  out += "- Preserve unusual wording and ideas from the child rather than polishing them away.\n";

  document.getElementById("summary").textContent = out.trim();
  return out.trim();
}
async function copySummary(){
  const text = buildSummary();
  try{
    await navigator.clipboard.writeText(text);
    alert("Summary copied.");
  }catch(e){
    alert("Copy was blocked by the browser. Select the summary manually.");
  }
}
function downloadSummary(){
  const text = buildSummary();
  const blob = new Blob([text], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventor-discovery-brief.txt";
  a.click();
  URL.revokeObjectURL(url);
}
function resetForm(){
  if(confirm("Clear everything entered in this form?")){
    document.getElementById("ideaForm").reset();
    document.getElementById("summary").textContent = "Your captured discovery brief will appear here.";
  }
}

async function sharePage(){
  const shareData = {
    title: "What should we make?",
    text: "A child-led idea discovery form for inventing something together.",
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("Link copied.");
  } catch (e) {
    alert("Sharing is not available here. Copy the page address manually.");
  }
}

document.getElementById("generateButton").addEventListener("click", buildSummary);
document.getElementById("copyButton").addEventListener("click", copySummary);
document.getElementById("downloadButton").addEventListener("click", downloadSummary);
document.getElementById("clearButton").addEventListener("click", resetForm);
document.getElementById("shareButton").addEventListener("click", sharePage);

document.getElementById("ideaForm").addEventListener("submit", (event) => event.preventDefault());
