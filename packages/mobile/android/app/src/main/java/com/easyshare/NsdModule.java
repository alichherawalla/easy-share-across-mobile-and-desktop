package com.easyshare;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class NsdModule extends ReactContextBaseJavaModule {
    private static final String TAG = "NsdModule";
    private static final String SERVICE_TYPE = "_easyshare._tcp.";

    private NsdManager nsdManager;
    private NsdManager.DiscoveryListener discoveryListener;
    private NsdManager.RegistrationListener registrationListener;
    private NsdServiceInfo registeredService;
    private boolean isDiscovering = false;

    public NsdModule(ReactApplicationContext reactContext) {
        super(reactContext);
        nsdManager = (NsdManager) reactContext.getSystemService(Context.NSD_SERVICE);
    }

    @Override
    public String getName() {
        return "NsdModule";
    }

    @ReactMethod
    public void startDiscovery(String serviceType, Promise promise) {
        if (isDiscovering) {
            promise.resolve(null);
            return;
        }

        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onDiscoveryStarted(String serviceType) {
                Log.d(TAG, "Discovery started: " + serviceType);
                isDiscovering = true;
            }

            @Override
            public void onServiceFound(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service found: " + serviceInfo.getServiceName());
                // Resolve the service to get full details
                nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                    @Override
                    public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
                        Log.e(TAG, "Resolve failed: " + errorCode);
                    }

                    @Override
                    public void onServiceResolved(NsdServiceInfo serviceInfo) {
                        sendServiceFoundEvent(serviceInfo);
                    }
                });
            }

            @Override
            public void onServiceLost(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service lost: " + serviceInfo.getServiceName());
                sendServiceLostEvent(serviceInfo.getServiceName());
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
                Log.d(TAG, "Discovery stopped: " + serviceType);
                isDiscovering = false;
            }

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                Log.e(TAG, "Start discovery failed: " + errorCode);
                isDiscovering = false;
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
                Log.e(TAG, "Stop discovery failed: " + errorCode);
            }
        };

        try {
            nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("DISCOVERY_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopDiscovery(Promise promise) {
        if (!isDiscovering || discoveryListener == null) {
            promise.resolve(null);
            return;
        }

        try {
            nsdManager.stopServiceDiscovery(discoveryListener);
            isDiscovering = false;
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("STOP_DISCOVERY_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void registerService(String serviceName, String serviceType, int port, ReadableMap txtRecord, Promise promise) {
        NsdServiceInfo serviceInfo = new NsdServiceInfo();
        serviceInfo.setServiceName(serviceName);
        serviceInfo.setServiceType(SERVICE_TYPE);
        serviceInfo.setPort(port);

        // Add TXT record attributes
        if (txtRecord != null) {
            for (Map.Entry<String, Object> entry : txtRecord.toHashMap().entrySet()) {
                serviceInfo.setAttribute(entry.getKey(), entry.getValue().toString());
            }
        }

        registrationListener = new NsdManager.RegistrationListener() {
            @Override
            public void onServiceRegistered(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service registered: " + serviceInfo.getServiceName());
                registeredService = serviceInfo;
            }

            @Override
            public void onRegistrationFailed(NsdServiceInfo serviceInfo, int errorCode) {
                Log.e(TAG, "Registration failed: " + errorCode);
            }

            @Override
            public void onServiceUnregistered(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service unregistered: " + serviceInfo.getServiceName());
                registeredService = null;
            }

            @Override
            public void onUnregistrationFailed(NsdServiceInfo serviceInfo, int errorCode) {
                Log.e(TAG, "Unregistration failed: " + errorCode);
            }
        };

        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("REGISTRATION_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void unregisterService(Promise promise) {
        if (registrationListener == null || registeredService == null) {
            promise.resolve(null);
            return;
        }

        try {
            nsdManager.unregisterService(registrationListener);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("UNREGISTRATION_ERROR", e.getMessage());
        }
    }

    private void sendServiceFoundEvent(NsdServiceInfo serviceInfo) {
        WritableMap params = Arguments.createMap();
        params.putString("name", serviceInfo.getServiceName());
        params.putString("type", serviceInfo.getServiceType());
        params.putInt("port", serviceInfo.getPort());

        InetAddress host = serviceInfo.getHost();
        if (host != null) {
            params.putString("host", host.getHostAddress());
        }

        // Add TXT record attributes
        WritableMap txt = Arguments.createMap();
        Map<String, byte[]> attributes = serviceInfo.getAttributes();
        for (Map.Entry<String, byte[]> entry : attributes.entrySet()) {
            if (entry.getValue() != null) {
                txt.putString(entry.getKey(), new String(entry.getValue(), StandardCharsets.UTF_8));
            }
        }
        params.putMap("txt", txt);

        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onServiceFound", params);
    }

    private void sendServiceLostEvent(String serviceName) {
        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onServiceLost", serviceName);
    }
}
