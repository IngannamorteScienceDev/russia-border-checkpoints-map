const BASE_STYLE =
  "https://raw.githubusercontent.com/maplibre/demotiles/gh-pages/style.json";

const COLORS = {
  "Автомобильный": "#3b82f6",
  "Железнодорожный": "#22c55e",
  "Воздушный": "#a855f7",
  "Морской": "#0ea5e9",
  "Речной": "#14b8a6",
};

const loader = document.getElementById("loader");
const loaderStep = document.getElementById("loaderStep");
const emptyState = document.getElementById("emptyState");
const statsEl = document.getElementById("stats");
const updateDateEl = document.getElementById("updateDate");

let geoData = null;
let filtered = [];
let selectedIds = new Set();
let nightMode = true;

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE,
  center: [90, 61],
  zoom: 4,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl(), "bottom-right");

map.on("error", e => console.error("Map error:", e.error));

loaderStep.textContent = "Загрузка стиля карты…";

fetch("data/checkpoints.geojson")
  .then(r => r.json())
  .then(data => {
    geoData = data;
    filtered = data.features;

    updateDateEl.textContent =
      new Date(data.metadata?.updated_at || Date.now()).toLocaleDateString("ru-RU");

    loaderStep.textContent = "Добавление данных КПП…";

    map.on("style.load", () => {
      addLayers();
      applyFog();
      updateStats();
      loader.style.display = "none";
    });
  });

function applyFog(){
  try{
    map.setFog({
      range:[0.8,8],
      color:"rgb(2,6,23)",
      "high-color":"rgb(15,23,42)",
      "space-color":"rgb(2,6,23)",
      "horizon-blend":0.25,
      starIntensity:0.15
    });
  }catch{}
}

function addLayers(){
  map.addSource("checkpoints",{
    type:"geojson",
    data: geoData,
    promoteId:"checkpoint_id"
  });

  map.addLayer({
    id:"points",
    type:"circle",
    source:"checkpoints",
    paint:{
      "circle-radius":6,
      "circle-color":[
        "match",["get","checkpoint_type"],
        "Автомобильный",COLORS["Автомобильный"],
        "Железнодорожный",COLORS["Железнодорожный"],
        "Воздушный",COLORS["Воздушный"],
        "Морской",COLORS["Морской"],
        "Речной",COLORS["Речной"],
        "#64748b"
      ],
      "circle-stroke-width":[
        "case",
        ["boolean",["feature-state","selected"],false],
        3,1
      ],
      "circle-stroke-color":[
        "case",
        ["boolean",["feature-state","selected"],false],
        "#facc15","#020617"
      ]
    }
  });

  map.on("click","points",e=>{
    const f = e.features[0];
    const id = f.id ?? f.properties.checkpoint_id;
    toggleSelect(id);

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<b>${f.properties.checkpoint_name}</b><br>${f.properties.subject_name}`)
      .addTo(map);
  });
}

function toggleSelect(id){
  if(selectedIds.has(id)){
    selectedIds.delete(id);
    map.setFeatureState({source:"checkpoints",id},{selected:false});
  }else{
    selectedIds.add(id);
    map.setFeatureState({source:"checkpoints",id},{selected:true});
  }
  updateStats();
}

function updateStats(){
  statsEl.innerHTML =
    `Отображено КПП: <b>${filtered.length}</b><br>
     Выбрано КПП: <b>${selectedIds.size}</b>`;

  emptyState.style.display = filtered.length === 0 ? "block" : "none";
}

document.getElementById("btnExport").onclick = ()=>{
  const rows = geoData.features
    .filter(f=>selectedIds.has(f.properties.checkpoint_id))
    .map(f=>{
      const p = f.properties;
      const [lon,lat]=f.geometry.coordinates;
      return `"${p.checkpoint_name}","${p.subject_name}",${lat},${lon}`;
    });

  if(!rows.length){
    alert("Нет выбранных КПП");
    return;
  }

  const csv = "name,region,lat,lon\n"+rows.join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="selected_checkpoints.csv";
  a.click();
};
