/* Café Cumbre - sitio de práctica (datos ficticios, guardados en el navegador). */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var PROD = [
    { id: "espresso", n: "Espresso", c: "Café caliente", p: 6500 }, { id: "latte", n: "Latte", c: "Café caliente", p: 9500 },
    { id: "capuchino", n: "Capuchino", c: "Café caliente", p: 9000 }, { id: "coldbrew", n: "Cold brew", c: "Café frío", p: 11000 },
    { id: "frappe", n: "Frappé de caramelo", c: "Café frío", p: 13500 }, { id: "croissant", n: "Croissant", c: "Panadería", p: 7000 },
    { id: "brownie", n: "Brownie", c: "Panadería", p: 6500 }, { id: "sandwich", n: "Sándwich de pollo", c: "Panadería", p: 15000 }
  ];
  var USERS = { cliente01: { c: "Cliente2026!", r: "cliente" }, barista01: { c: "Barista2026!", r: "barista" } };
  var EST = ["Recibido", "En preparación", "Listo"], VISTAS = ["ingreso", "menu", "carrito", "seguimiento", "admin"];

  /* ---- utilidades y registro de eventos ---- */
  window.cafeLog = []; window.cafeMetricas = { cargaMs: 0 };
  function log(t, e) { window.cafeLog.push({ tipo: e ? "error" : "info", texto: t }); (e ? console.error : console.info)("[Café] " + t); }
  function msg(i, t, k) { var e = $(i); e.textContent = t; e.className = "mensaje" + (k ? " " + k : ""); }
  function err(c, t) { $("e-" + c).textContent = t; $(c).classList.toggle("invalido", !!t); return !t; }
  function td(tr, t) { var d = document.createElement("td"); d.textContent = t; tr.appendChild(d); return d; } // textContent evita inyección
  function btn(t, id, f) { var b = document.createElement("button"); b.type = "button"; b.textContent = t; b.id = id; b.addEventListener("click", f); return b; }
  function money(n) { return "$" + n.toLocaleString("es-CO"); }
  function leer() { try { var g = localStorage.getItem("cafe_db"); if (g) { return JSON.parse(g); } } catch (e) { } return { seq: 0, pedidos: [] }; }
  function escribir(db) { try { localStorage.setItem("cafe_db", JSON.stringify(db)); } catch (e) { } }
  function guardar(msgId, fn) { // si no hay conexión no se guarda nada
    if ($("modo-sin-conexion").checked) { msg(msgId, "No se pudo guardar: no hay conexión. No se perdió ni duplicó ningún dato, inténtalo de nuevo.", "fallo"); log("Guardado fallido sin conexión", true); return false; }
    var db = leer(), ok; try { ok = fn(db); } catch (e) { msg(msgId, e.message, "fallo"); log(e.message, true); return false; }
    escribir(db); msg(msgId, ok, "exito"); log(ok); renderTodo(); return true;
  }

  /* ---- sesión, roles e inactividad ---- */
  var LIM = parseInt(new URLSearchParams(location.search).get("inactividad"), 10) || 60, ult = Date.now(), ses = null, car = {}, cupon = false;
  try { ses = JSON.parse(sessionStorage.getItem("cafe_ses")); } catch (e) { }
  try { car = JSON.parse(sessionStorage.getItem("cafe_car")) || {}; } catch (e) { }
  function barista() { return ses && ses.r === "barista"; }
  function vista(v) {
    VISTAS.forEach(function (x) { $("vista-" + x).hidden = x !== v; $("nav-" + x).classList.toggle("activo", x === v); });
    if (v === "admin") { renderAdmin(); } log("Vista: " + v);
  }
  function aplicarSesion() {
    $("nav-carrito").disabled = !ses; $("nav-admin").disabled = !ses;
    ["btn-salir", "usuario-activo", "sesion-restante"].forEach(function (i) { $(i).hidden = !ses; });
    $("usuario-activo").textContent = ses ? "Sesión: " + ses.u + " (" + ses.r + ")" : "";
  }
  function salir(aviso) {
    ses = null; sessionStorage.removeItem("cafe_ses"); aplicarSesion(); vista("ingreso");
    $("form-login").reset(); $("login-error").textContent = aviso || ""; log(aviso || "Sesión cerrada");
  }
  ["click", "keydown"].forEach(function (e) { document.addEventListener(e, function () { ult = Date.now(); }); });
  setInterval(function () {
    if (!ses) { return; } var r = LIM - Math.floor((Date.now() - ult) / 1000);
    $("sesion-restante").textContent = "Expira en " + Math.max(r, 0) + " s"; if (r <= 0) { salir("Sesión expirada por inactividad. Ingresa de nuevo."); }
  }, 1000);
  document.querySelectorAll(".menu button").forEach(function (b) { b.addEventListener("click", function () { if (!b.disabled) { vista(b.getAttribute("data-v")); } }); });
  $("btn-salir").addEventListener("click", function () { salir(""); });

  var fallos = 0;
  $("form-login").addEventListener("submit", function (e) {
    e.preventDefault(); if ($("btn-ingresar").disabled) { return; }
    var u = $("login-usuario").value.trim(), c = $("login-clave").value; $("login-error").textContent = "";
    var a = err("login-usuario", u ? "" : "Escribe tu usuario."), b = err("login-clave", c ? "" : "Escribe tu contraseña."); if (!a || !b) { return; }
    if (USERS[u] && USERS[u].c === c) {
      fallos = 0; ses = { u: u, r: USERS[u].r }; sessionStorage.setItem("cafe_ses", JSON.stringify(ses)); ult = Date.now(); aplicarSesion(); vista("menu"); log("Ingreso: " + u); return;
    }
    fallos++; log("Ingreso fallido " + fallos, true);
    if (fallos >= 3) { $("btn-ingresar").disabled = true; $("login-error").textContent = "Cuenta bloqueada temporalmente. Intenta de nuevo en 30 segundos.";
      setTimeout(function () { fallos = 0; $("btn-ingresar").disabled = false; $("login-error").textContent = ""; }, 30000); }
    else { $("login-error").textContent = "Usuario o contraseña incorrectos. Te quedan " + (3 - fallos) + " intentos."; }
  });

  /* ---- menú ---- */
  function renderMenu() {
    var t = $("filtro-menu").value.trim().toLowerCase(), cat = $("filtro-cat").value;
    if (!err("filtro-menu", /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]*$/.test(t) ? "" : "Solo se permiten letras y números.")) { return; }
    var l = $("lista-menu"); l.innerHTML = "";
    PROD.filter(function (p) { return (!cat || p.c === cat) && p.n.toLowerCase().indexOf(t) !== -1; }).forEach(function (p) {
      var d = document.createElement("div"); d.className = "tarjeta";
      var h = document.createElement("h3"); h.textContent = p.n; var s = document.createElement("p"); s.textContent = p.c;
      var pr = document.createElement("strong"); pr.textContent = money(p.p);
      d.appendChild(h); d.appendChild(s); d.appendChild(pr); d.appendChild(btn("Agregar al carrito", "add-" + p.id, function () { agregar(p); })); l.appendChild(d);
    });
    if (!l.children.length) { msg("msg-menu", "No hay productos que coincidan con tu búsqueda.", "aviso"); } else { msg("msg-menu", ""); }
  }
  $("filtro-menu").addEventListener("input", renderMenu); $("filtro-cat").addEventListener("change", renderMenu);
  function agregar(p) {
    if (!ses) { msg("msg-menu", "Ingresa a tu cuenta para agregar productos al carrito.", "fallo"); return; }
    car[p.id] = (car[p.id] || 0) + 1; guardarCarro(); msg("msg-menu", p.n + " agregado al carrito.", "exito"); log("Agregado " + p.n);
  }

  /* ---- carrito y pedido ---- */
  function guardarCarro() { sessionStorage.setItem("cafe_car", JSON.stringify(car)); renderCarrito(); }
  function totales() {
    var s = 0; PROD.forEach(function (p) { s += (car[p.id] || 0) * p.p; });
    var d = cupon ? Math.round(s * 0.1) : 0; return { s: s, d: d, t: s - d };
  }
  function renderCarrito() {
    var c = $("cuerpo-carrito"), n = 0; c.innerHTML = "";
    PROD.forEach(function (p) {
      var q = car[p.id]; if (!q) { return; } n += q; var tr = document.createElement("tr");
      td(tr, p.n); td(tr, q); td(tr, money(q * p.p)); var a = td(tr, "");
      a.appendChild(btn("+", "mas-" + p.id, function () { car[p.id]++; guardarCarro(); }));
      a.appendChild(btn("-", "menos-" + p.id, function () { car[p.id]--; if (!car[p.id]) { delete car[p.id]; } guardarCarro(); }));
      a.appendChild(btn("Quitar", "quitar-" + p.id, function () { delete car[p.id]; guardarCarro(); })); c.appendChild(tr);
    });
    var t = totales(); $("carrito-cuenta").textContent = n; $("carrito-vacio").hidden = n > 0;
    $("subtotal").textContent = money(t.s); $("descuento").textContent = money(t.d); $("total").textContent = money(t.t);
  }
  $("btn-vaciar").addEventListener("click", function () { car = {}; cupon = false; guardarCarro(); msg("msg-cupon", "Carrito vaciado.", "aviso"); });
  $("btn-cupon").addEventListener("click", function () {
    var v = $("cupon").value.trim().toUpperCase();
    if (v === "CAFE10") { cupon = true; msg("msg-cupon", "Cupón aplicado: 10% de descuento.", "exito"); } else { cupon = false; msg("msg-cupon", "Cupón inválido o vencido.", "fallo"); }
    renderCarrito();
  });
  $("form-pedido").addEventListener("submit", function (e) {
    e.preventDefault(); msg("msg-pedido", "");
    var n = $("f-nombre").value.trim(), tel = $("f-tel").value.trim(), sede = $("f-sede").value, pago = $("f-pago").value, notas = $("f-notas").value.trim();
    var v = [err("f-nombre", /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]{3,60}$/.test(n) ? "" : "El nombre debe tener entre 3 y 60 letras, sin números."),
      err("f-tel", /^3\d{9}$/.test(tel) ? "" : "Escribe un celular de 10 dígitos que empiece por 3."),
      err("f-sede", sede ? "" : "Selecciona una sede."), err("f-pago", pago ? "" : "Selecciona un método de pago.")];
    if (v.indexOf(false) !== -1) { msg("msg-pedido", "Revisa los campos marcados.", "fallo"); return; }
    if (!Object.keys(car).length) { msg("msg-pedido", "Tu carrito está vacío: agrega al menos un producto.", "fallo"); return; }
    var t = totales(), items = PROD.filter(function (p) { return car[p.id]; }).map(function (p) { return car[p.id] + " x " + p.n; });
    if (guardar("msg-pedido", function (db) {
      db.seq++; var cod = "PED-" + String(db.seq).padStart(4, "0");
      db.pedidos.push({ codigo: cod, nombre: n, tel: tel, sede: sede, pago: pago, notas: notas, items: items, total: t.t, estado: "Recibido" });
      return "Pedido " + cod + " confirmado. Total: " + money(t.t) + ".";
    })) { car = {}; cupon = false; guardarCarro(); $("form-pedido").reset(); }
  });

  /* ---- seguimiento (teléfono enmascarado) ---- */
  var consultado = null;
  function pintarSeg() {
    var p = leer().pedidos.filter(function (x) { return x.codigo === consultado; })[0]; if (!p) { return; }
    $("s-titulo").textContent = "Pedido " + p.codigo; $("s-nombre").textContent = p.nombre; $("s-tel").textContent = "******" + p.tel.slice(-4);
    $("s-items").textContent = p.items.join(", "); $("s-total").textContent = money(p.total); $("s-estado").textContent = p.estado; $("seg-panel").hidden = false;
  }
  $("form-seg").addEventListener("submit", function (e) {
    e.preventDefault(); $("seg-panel").hidden = true; msg("msg-seg", ""); consultado = null;
    var cod = $("s-codigo").value.trim().toUpperCase(); if (!err("s-codigo", /^PED-\d{4}$/.test(cod) ? "" : "Usa el formato PED- seguido de 4 dígitos.")) { return; }
    $("cargando").hidden = false; $("btn-buscar").disabled = true;
    setTimeout(function () {
      $("cargando").hidden = true; $("btn-buscar").disabled = false;
      if (!leer().pedidos.some(function (x) { return x.codigo === cod; })) { msg("msg-seg", "No encontramos un pedido con ese código. Verifícalo e inténtalo de nuevo.", "fallo"); }
      else { consultado = cod; pintarSeg(); }
    }, 300);
  });

  /* ---- administración (solo barista) ---- */
  $("filtro-ped").addEventListener("input", renderAdmin);
  function renderAdmin() {
    var ok = barista(); $("admin-denegado").hidden = ok; $("admin-contenido").hidden = !ok;
    if (!ok) { if (!$("vista-admin").hidden) { log("Acceso denegado a administración", true); } return; }
    var f = $("filtro-ped").value.trim().toUpperCase(); if (!err("filtro-ped", /^[A-Z0-9-]*$/.test(f) ? "" : "Solo letras, números y guiones.")) { return; }
    var db = leer(), c = $("cuerpo-admin"); c.innerHTML = "";
    var cnt = function (s) { return db.pedidos.filter(function (p) { return p.estado === s; }).length; };
    $("a-total").textContent = db.pedidos.length; $("a-recibido").textContent = cnt(EST[0]); $("a-prep").textContent = cnt(EST[1]); $("a-listo").textContent = cnt(EST[2]);
    db.pedidos.forEach(function (p) {
      if (f && p.codigo.indexOf(f) === -1) { return; } var tr = document.createElement("tr");
      td(tr, p.codigo); td(tr, p.nombre); td(tr, p.sede); td(tr, money(p.total)); td(tr, p.estado);
      td(tr, "").appendChild(btn("Avanzar estado", "avanzar-" + p.codigo, function () {
        guardar("msg-admin", function (d) {
          var o = d.pedidos.filter(function (x) { return x.codigo === p.codigo; })[0], i = EST.indexOf(o.estado);
          if (i >= EST.length - 1) { throw new Error("El pedido " + p.codigo + " ya está listo."); } o.estado = EST[i + 1]; return "Pedido " + p.codigo + ": " + o.estado + ".";
        });
      })); c.appendChild(tr);
    });
  }
  $("btn-exportar").addEventListener("click", function () {
    var db = leer(), filas = [["Pedido", "Cliente", "Sede", "Pago", "Productos", "Total", "Estado"]];
    db.pedidos.forEach(function (p) { filas.push([p.codigo, p.nombre, p.sede, p.pago, p.items.join("; "), p.total, p.estado]); });
    var csv = filas.map(function (f) { return f.map(function (c) { c = String(c); if (/^[=+\-@]/.test(c)) { c = "'" + c; } return '"' + c.replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "cafe_pedidos.csv"; document.body.appendChild(a); a.click(); a.remove(); msg("msg-admin", "Se exportaron " + db.pedidos.length + " pedidos en cafe_pedidos.csv.", "exito");
  });
  $("btn-reiniciar").addEventListener("click", function () { escribir({ seq: 0, pedidos: [] }); renderTodo(); msg("msg-admin", "Datos restablecidos.", "aviso"); });

  /* ---- inicio ---- */
  function renderTodo() { renderCarrito(); renderAdmin(); pintarSeg(); }
  window.addEventListener("storage", function (e) { if (e.key === "cafe_db") { renderTodo(); } });
  window.addEventListener("error", function (e) { log("Excepción: " + e.message, true); });
  window.addEventListener("load", function () { var ms = Math.round(performance.now()); window.cafeMetricas.cargaMs = ms; $("carga-ms").textContent = ms; });
  renderMenu(); renderTodo(); aplicarSesion(); vista(ses ? "menu" : "ingreso");
})();
