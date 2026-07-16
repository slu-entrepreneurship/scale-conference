class VenueExperience {
  constructor() {
    this.config = null;
    this.map = null;
    this.directionsRenderer = null;
    this.directionsService = null;
    this.markers = [];
    this.layerMarkers = new Map();
    this.placesService = null;
    this.apiKey = window.SLI_GOOGLE_MAPS_API_KEY || localStorage.getItem('SLI_GOOGLE_MAPS_API_KEY') || '';
    this.init();
  }

  async init() {
    this.config = await this.loadConfig();
    this.renderStaticContent();
    this.bindActions();
    this.renderFallbackAmenities();

    if (!this.apiKey) {
      this.showFallback();
      return;
    }

    try {
      await this.loadGoogleMaps();
      await this.initMap();
    } catch (error) {
      console.warn('Google Maps failed to initialize:', error);
      this.showFallback();
    }
  }

  async loadConfig() {
    const response = await fetch('data/venue.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load venue.json');
    return response.json();
  }

  loadGoogleMaps() {
    if (window.google?.maps) return Promise.resolve();
    const libraries = this.config.googleMaps?.libraries?.join(',') || 'places,geometry';
    return new Promise((resolve, reject) => {
      window.initSLIVenueMap = resolve;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(this.apiKey)}&libraries=${encodeURIComponent(libraries)}&callback=initSLIVenueMap`;
      script.async = true;
      script.defer = true;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async initMap() {
    const venue = await this.resolveLocation(this.config.venue);
    const parking = await this.resolveLocation(this.config.parking);
    const center = {
      lat: (venue.latitude + parking.latitude) / 2,
      lng: (venue.longitude + parking.longitude) / 2
    };

    this.map = new google.maps.Map(document.getElementById('google-map'), {
      center,
      zoom: this.config.googleMaps?.defaultZoom || 17,
      mapId: this.config.googleMaps?.mapId || undefined,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        mapTypeIds: ['roadmap', 'satellite']
      },
      streetViewControl: true,
      zoomControl: true,
      fullscreenControl: true,
      clickableIcons: true
    });

    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#0b62d6',
        strokeOpacity: 0.92,
        strokeWeight: 6
      }
    });
    this.placesService = new google.maps.places.PlacesService(this.map);

    this.addMarker(venue, venue.navigationLabel || `${venue.name} – Main Entrance`, '#c8a45a');
    this.addMarker(parking, parking.name || 'Laclede Parking Garage', '#0b3d7c');
    this.calculateWalkingRoute(parking, venue);
    this.renderLayerControls();
  }

  async resolveLocation(location) {
    if (Number(location.latitude) && Number(location.longitude)) {
      return {
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude)
      };
    }
    const geocoder = new google.maps.Geocoder();
    const result = await geocoder.geocode({ address: location.address });
    const match = result.results[0];
    if (!match) throw new Error(`Unable to geocode ${location.name}`);
    return {
      ...location,
      latitude: match.geometry.location.lat(),
      longitude: match.geometry.location.lng(),
      googleMapsLink: location.googleMapsLink || match.url || this.googleMapsSearchUrl(location)
    };
  }

  addMarker(location, title, color) {
    const markerLabel = location.navigationLabel || title;
    const marker = new google.maps.Marker({
      map: this.map,
      title: markerLabel,
      position: { lat: location.latitude, lng: location.longitude },
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 4
      }
    });
    const infoWindow = new google.maps.InfoWindow({
      content: `<strong>${this.escape(markerLabel)}</strong><br>${this.escape(location.address)}`
    });
    marker.addListener('click', () => infoWindow.open({ anchor: marker, map: this.map }));
    this.markers.push(marker);
  }

  calculateWalkingRoute(origin, destination) {
    this.directionsService.route({
      origin: { lat: origin.latitude, lng: origin.longitude },
      destination: { lat: destination.latitude, lng: destination.longitude },
      travelMode: google.maps.TravelMode.WALKING
    }, (result, status) => {
      if (status !== 'OK' || !result.routes[0]) {
        this.setRouteStatus('Walking route could not be calculated. Use Google Maps directions for live routing.');
        return;
      }
      this.directionsRenderer.setDirections(result);
      const leg = result.routes[0].legs[0];
      this.setWalkingMetrics(leg.distance?.text || '--', leg.duration?.text || '--');
      this.setRouteStatus('Walking route from parking to Cook Hall is shown in blue.');
    });
  }

  renderLayerControls() {
    const controls = document.getElementById('amenity-layer-controls');
    controls.innerHTML = this.config.amenityLayers.map((layer) => `
      <button class="layer-toggle" type="button" data-layer="${this.escapeAttr(layer.id)}" aria-pressed="false">${this.escape(layer.label)}</button>
    `).join('');
    controls.querySelectorAll('.layer-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        const layer = this.config.amenityLayers.find((item) => item.id === button.dataset.layer);
        const active = button.classList.toggle('active');
        button.setAttribute('aria-pressed', String(active));
        active ? this.showLayer(layer) : this.hideLayer(layer.id);
      });
    });
  }

  showLayer(layer) {
    if (!layer) return;
    if (layer.items?.length) {
      const markers = layer.items.map((item) => this.createAmenityMarker(item, layer.label));
      this.layerMarkers.set(layer.id, markers);
      return;
    }
    if (!layer.googleType || !this.placesService) return;
    this.placesService.nearbySearch({
      location: { lat: Number(this.config.venue.latitude), lng: Number(this.config.venue.longitude) },
      radius: 1200,
      type: layer.googleType
    }, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;
      const markers = results.slice(0, 8).map((place) => this.createAmenityMarker({
        name: place.name,
        address: place.vicinity,
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng()
      }, layer.label));
      this.layerMarkers.set(layer.id, markers);
    });
  }

  createAmenityMarker(item, label) {
    const marker = new google.maps.Marker({
      map: this.map,
      title: `${label}: ${item.name}`,
      position: { lat: Number(item.latitude), lng: Number(item.longitude) },
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#2f80ed',
        fillOpacity: 0.9,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });
    const infoWindow = new google.maps.InfoWindow({
      content: `<strong>${this.escape(item.name)}</strong><br>${this.escape(item.address || label)}`
    });
    marker.addListener('click', () => infoWindow.open({ anchor: marker, map: this.map }));
    return marker;
  }

  hideLayer(layerId) {
    const markers = this.layerMarkers.get(layerId) || [];
    markers.forEach((marker) => marker.setMap(null));
    this.layerMarkers.delete(layerId);
  }

  renderStaticContent() {
    document.title = `Venue & Parking | ${this.config.eventName || 'Summer Learning Institute'}`;
    document.getElementById('venue-hero-title').textContent = this.config.copy?.heroTitle || 'Venue & Parking';
    document.getElementById('venue-hero-subtitle').textContent = this.config.copy?.heroSubtitle || '';
    document.getElementById('map-heading').textContent = this.config.venue.name;
    this.renderLocationCards();
    this.renderLayerControlsFallback();
    this.estimateFallbackRoute();
  }

  renderLocationCards() {
    const cards = document.getElementById('location-cards');
    const venue = this.config.venue;
    const parking = this.config.parking;
    cards.innerHTML = `
      ${this.locationCard({
        type: 'venue',
        title: venue.name,
        label: venue.label || 'Event Hall',
        navigationLabel: venue.navigationLabel || `${venue.name} – Main Entrance`,
        address: venue.address,
        imageLabel: 'Hall',
        primaryLabel: 'Get Directions',
        details: venue.details || [],
        body: this.config.copy?.buildingInformation || ''
      })}
      ${this.locationCard({
        type: 'parking',
        title: parking.name,
        label: parking.label || 'Parking',
        address: parking.address,
        imageLabel: 'Park',
        primaryLabel: 'Open Google Maps',
        details: parking.tips || [],
        body: this.config.copy?.visitorParkingInformation || ''
      })}
    `;
  }

  locationCard({ type, title, label, address, imageLabel, primaryLabel, details, body }) {
    return `
      <article class="location-card">
        <div class="location-image"><span>${this.escape(imageLabel)}</span></div>
        <div class="location-content">
          <p class="card-label">${this.escape(label)}</p>
          <h2>${this.escape(title)}</h2>
          ${type === 'venue' ? `<p class="navigation-label">${this.escape(this.config.venue.navigationLabel || `${title} – Main Entrance`)}</p>` : ''}
          <address>${this.escape(address)}</address>
          <p>${this.escape(body)}</p>
          <div class="action-grid">
            <button class="action-button primary" data-action="directions" data-target="${type}" type="button">${this.escape(primaryLabel)}</button>
            ${type === 'parking' ? '<button class="action-button primary" data-action="walking" data-target="parking" type="button">Walking Route</button>' : ''}
            <button class="action-button" data-action="google" data-target="${type}" type="button">Google Maps</button>
            <button class="action-button" data-action="apple" data-target="${type}" type="button">Apple Maps</button>
            <button class="action-button" data-action="waze" data-target="${type}" type="button">Waze</button>
            <button class="action-button" data-action="copy" data-target="${type}" type="button">Copy Address</button>
            <button class="action-button" data-action="streetview" data-target="${type}" type="button">Street View</button>
          </div>
          ${type === 'parking' ? '<div class="parking-route-chip"><strong id="parking-card-distance">--</strong><span id="parking-card-duration">Walking route</span></div>' : ''}
          <ul class="info-list">
            ${details.map((item) => `<li>${this.escape(item)}</li>`).join('')}
          </ul>
        </div>
      </article>
    `;
  }

  renderLayerControlsFallback() {
    const controls = document.getElementById('amenity-layer-controls');
    if (controls.innerHTML.trim()) return;
    controls.innerHTML = this.config.amenityLayers.map((layer) => `
      <button class="layer-toggle" type="button" data-layer="${this.escapeAttr(layer.id)}" aria-pressed="false">${this.escape(layer.label)}</button>
    `).join('');
  }

  renderFallbackAmenities() {
    const container = document.getElementById('nearby-amenities');
    container.innerHTML = this.config.amenityLayers.map((layer) => `
      <article class="nearby-card">
        <strong>${this.escape(layer.label)}</strong>
        <p>${layer.googleType ? 'Available as a live Google Maps layer when the API key is configured.' : 'Optional custom locations can be added in venue.json.'}</p>
      </article>
    `).join('');
  }

  bindActions() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
    if (!button) return;
      this.handleAction(button.dataset.action, button.dataset.target);
    });
    document.getElementById('primary-navigate')?.addEventListener('click', () => this.openDirections('venue'));
    document.getElementById('sticky-navigate-button')?.addEventListener('click', () => this.openDirections('venue'));
    document.getElementById('share-location')?.addEventListener('click', () => this.shareLocation());
    document.getElementById('print-directions')?.addEventListener('click', () => window.print());
  }

  handleAction(action, target) {
    if (action === 'copy') return this.copyAddress(target);
    if (action === 'apple') return window.open(this.appleMapsUrl(target), '_blank', 'noopener');
    if (action === 'waze') return window.open(this.wazeUrl(target), '_blank', 'noopener');
    if (action === 'streetview') return window.open(this.streetViewUrl(target), '_blank', 'noopener');
    if (action === 'walking') return window.open(this.walkingRouteUrl(), '_blank', 'noopener');
    if (action === 'google') return window.open(this.openGoogleMapsUrl(target), '_blank', 'noopener');
    if (action === 'directions') return this.openDirections(target);
    return null;
  }

  openDirections(target = 'venue') {
    const location = this.locationFor(target);
    window.open(this.googleDirectionsUrl(location), '_blank', 'noopener');
  }

  async copyAddress(target) {
    const location = this.locationFor(target);
    await navigator.clipboard?.writeText(location.address);
    this.toast('Address copied');
  }

  async shareLocation() {
    const location = this.config.venue;
    const shareData = {
      title: location.navigationLabel || location.name,
      text: `${location.navigationLabel || location.name} - ${location.address}`,
      url: this.googleDirectionsUrl(location)
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard?.writeText(shareData.url);
      this.toast('Location link copied');
    }
  }

  locationFor(target) {
    return target === 'parking' ? this.config.parking : this.config.venue;
  }

  googleDirectionsUrl(location) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${location.latitude},${location.longitude}`)}&travelmode=${location === this.config.parking ? 'driving' : 'driving'}`;
  }

  openGoogleMapsUrl(target) {
    const location = this.locationFor(target);
    if (location.googleMapsLink) return location.googleMapsLink;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
  }

  walkingRouteUrl() {
    const parking = this.config.parking;
    const venue = this.config.venue;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${parking.latitude},${parking.longitude}`)}&destination=${encodeURIComponent(`${venue.latitude},${venue.longitude}`)}&travelmode=walking`;
  }

  appleMapsUrl(target) {
    const location = this.locationFor(target);
    return `https://maps.apple.com/?daddr=${encodeURIComponent(`${location.latitude},${location.longitude}`)}&q=${encodeURIComponent(location.name)}`;
  }

  wazeUrl(target) {
    const location = this.locationFor(target);
    return `https://www.waze.com/ul?ll=${encodeURIComponent(`${location.latitude},${location.longitude}`)}&navigate=yes`;
  }

  streetViewUrl(target) {
    const location = this.locationFor(target);
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
  }

  googleMapsSearchUrl(location) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address || location.name)}`;
  }

  estimateFallbackRoute() {
    const venue = this.config.venue;
    const parking = this.config.parking;
    const distanceMiles = this.haversineMiles(venue.latitude, venue.longitude, parking.latitude, parking.longitude);
    if (!Number.isFinite(distanceMiles)) return;
    this.setWalkingMetrics(`${distanceMiles.toFixed(2)} mi`, `${Math.max(2, Math.round(distanceMiles / 3 * 60))} min`);
    this.setRouteStatus('Estimated straight-line distance until Google Maps walking route is enabled.');
  }

  setWalkingMetrics(distance, duration) {
    document.getElementById('walking-distance').textContent = distance;
    document.getElementById('walking-duration').textContent = duration;
    const cardDistance = document.getElementById('parking-card-distance');
    const cardDuration = document.getElementById('parking-card-duration');
    if (cardDistance) cardDistance.textContent = distance;
    if (cardDuration) cardDuration.textContent = `${duration} walk to Cook Hall`;
  }

  haversineMiles(lat1, lon1, lat2, lon2) {
    const toRad = (value) => Number(value) * Math.PI / 180;
    const radius = 3958.8;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(a));
  }

  showFallback() {
    document.getElementById('google-map').hidden = true;
    document.getElementById('map-fallback').hidden = false;
  }

  setRouteStatus(message) {
    document.getElementById('route-status').textContent = message;
  }

  toast(message) {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  escapeAttr(value) {
    return this.escape(value).replace(/`/g, '&#96;');
  }
}

if (document.body.dataset.page === 'venue') {
  new VenueExperience();
}
