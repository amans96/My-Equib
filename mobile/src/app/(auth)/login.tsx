import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Phone,
  Wallet,
} from "lucide-react-native";

import { login } from "../../services/auth.service";
import { saveToken } from "../../services/storage";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Smart UX: Track focus states for a premium feel
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Smart validation: Only enable button if fields aren't empty
  const isFormValid = phone.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    setErrorMessage("");
    const trimmedPhone = phone.trim();

    try {
      setLoading(true);
      const response = await login(trimmedPhone, password);

      // Save JWT securely on the device
      await saveToken(response.data.token);

      // Login successful
      router.replace("/equbs");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Secure connection failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pb-8 pt-24">
          
          {/* Brand Header */}
          <View className="mb-10">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 shadow-sm">
              <Wallet size={30} color="#ffffff" strokeWidth={2.5} />
            </View>

            <Text className="text-3xl font-bold tracking-tight text-zinc-900">
              Welcome back
            </Text>

            <Text className="mt-2 text-base leading-6 text-gray-500">
              Sign in to manage your Equb and track your financial growth.
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View className="mb-6 rounded-2xl bg-red-50 p-4 border border-red-100">
              <Text className="text-sm font-medium text-red-600">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Phone Input */}
          <View className="mb-5">
            <Text className="mb-2 text-sm font-semibold text-zinc-800">
              Phone number
            </Text>

            <View
              className={`flex-row items-center rounded-2xl border px-4 transition-colors ${
                phoneFocused
                  ? "border-zinc-900 bg-white"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Phone
                size={20}
                color={phoneFocused ? "#18181b" : "#9ca3af"}
              />

              <TextInput
                className="ml-3 flex-1 py-4 text-base font-medium text-zinc-900"
                placeholder="0911 ••• •••"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={phone}
                onChangeText={setPhone}
                editable={!loading}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
            </View>
          </View>

          {/* Password Input */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-semibold text-zinc-800">
              Password
            </Text>

            <View
              className={`flex-row items-center rounded-2xl border px-4 transition-colors ${
                passwordFocused
                  ? "border-zinc-900 bg-white"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <LockKeyhole
                size={20}
                color={passwordFocused ? "#18181b" : "#9ca3af"}
              />

              <TextInput
                className="ml-3 flex-1 py-4 text-base font-medium text-zinc-900"
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                className="p-2"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#9ca3af" />
                ) : (
                  <Eye size={20} color="#9ca3af" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Forgot password */}
          <Pressable
            className="mb-10 self-end py-2"
            disabled={loading}
          >
            <Text className="text-sm font-bold text-zinc-900">
              Forgot password?
            </Text>
          </Pressable>

          {/* Login Button */}
          <Pressable
            className={`mb-8 flex-row items-center justify-center rounded-2xl py-4 ${
              isFormValid && !loading
                ? "bg-zinc-900 active:bg-zinc-800"
                : "bg-gray-200"
            }`}
            onPress={handleLogin}
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Text
                  className={`mr-2 text-base font-bold ${
                    isFormValid ? "text-white" : "text-gray-400"
                  }`}
                >
                  Secure Sign In
                </Text>
                <ArrowRight
                  size={20}
                  color={isFormValid ? "#ffffff" : "#9ca3af"}
                />
              </>
            )}
          </Pressable>

          {/* Register Link */}
          <View className="flex-row items-center justify-center mt-auto">
            <Text className="text-sm font-medium text-gray-500">
              New to our Equb?
            </Text>

            <Pressable
              onPress={() => router.push("/register")}
              className="ml-2 py-2"
              disabled={loading}
            >
              <Text className="text-sm font-bold text-zinc-900">
                Create an account
              </Text>
            </Pressable>
          </View>
          
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}