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
  Mail,
  Phone,
  User,
  Wallet,
} from "lucide-react-native";

import { register } from "../../services/auth.service";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Smart UX: Track focus states for each input
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  // Smart validation: Only enable button if required fields aren't empty
  const isFormValid =
    fullName.trim().length > 0 &&
    phone.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  const handleRegister = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    const nameParts = trimmedName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    if (!lastName) {
      setErrorMessage("Please enter both your first and last name.");
      return;
    }

    try {
      setLoading(true);

      const response = await register({
        firstName,
        lastName,
        phone: trimmedPhone,
        email: trimmedEmail || undefined,
        password,
      });

      setSuccessMessage(
        response.message || "Account created securely. Welcome!"
      );

      setTimeout(() => {
        router.replace("/login");
      }, 1500);
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
        <View className="flex-1 px-6 pb-8 pt-16">
          
          {/* Brand Header */}
          <View className="mb-8">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 shadow-sm">
              <Wallet size={30} color="#ffffff" strokeWidth={2.5} />
            </View>

            <Text className="text-3xl font-bold tracking-tight text-zinc-900">
              Create account
            </Text>

            <Text className="mt-2 text-base leading-6 text-gray-500">
              Join your Equb and start securely managing your contributions today.
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

          {/* Success Banner */}
          {successMessage ? (
            <View className="mb-6 rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
              <Text className="text-sm font-medium text-emerald-600">
                {successMessage}
              </Text>
            </View>
          ) : null}

          {/* Full Name Input */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-semibold text-zinc-800">
              Full name
            </Text>
            <View
              className={`flex-row items-center rounded-2xl border px-4 transition-colors ${
                nameFocused
                  ? "border-zinc-900 bg-white"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <User size={20} color={nameFocused ? "#18181b" : "#9ca3af"} />
              <TextInput
                className="ml-3 flex-1 py-4 text-base font-medium text-zinc-900"
                placeholder="Abebe Kebede"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>
          </View>

          {/* Phone Input */}
          <View className="mb-4">
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
              <Phone size={20} color={phoneFocused ? "#18181b" : "#9ca3af"} />
              <TextInput
                className="ml-3 flex-1 py-4 text-base font-medium text-zinc-900"
                placeholder="0911 ••• •••"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                editable={!loading}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
            </View>
          </View>

          {/* Email Input (Optional) */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-semibold text-zinc-800">
              Email <Text className="font-normal text-gray-400">(Optional)</Text>
            </Text>
            <View
              className={`flex-row items-center rounded-2xl border px-4 transition-colors ${
                emailFocused
                  ? "border-zinc-900 bg-white"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Mail size={20} color={emailFocused ? "#18181b" : "#9ca3af"} />
              <TextInput
                className="ml-3 flex-1 py-4 text-base font-medium text-zinc-900"
                placeholder="name@example.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
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
              <LockKeyhole size={20} color={passwordFocused ? "#18181b" : "#9ca3af"} />
              <TextInput
                className="ml-3 flex-1 py-4 text-base font-medium text-zinc-900"
                placeholder="Create a strong password"
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

          {/* Confirm Password Input */}
          <View className="mb-10">
            <Text className="mb-2 text-sm font-semibold text-zinc-800">
              Confirm password
            </Text>
            <View
              className={`flex-row items-center rounded-2xl border px-4 transition-colors ${
                confirmPasswordFocused
                  ? "border-zinc-900 bg-white"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <LockKeyhole size={20} color={confirmPasswordFocused ? "#18181b" : "#9ca3af"} />
              <TextInput
                className="ml-3 flex-1 py-4 text-base font-medium text-zinc-900"
                placeholder="Confirm your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
                onFocus={() => setConfirmPasswordFocused(true)}
                onBlur={() => setConfirmPasswordFocused(false)}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="p-2"
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#9ca3af" />
                ) : (
                  <Eye size={20} color="#9ca3af" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Register Button */}
          <Pressable
            className={`mb-8 flex-row items-center justify-center rounded-2xl py-4 ${
              isFormValid && !loading
                ? "bg-zinc-900 active:bg-zinc-800"
                : "bg-gray-200"
            }`}
            onPress={handleRegister}
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
                  Create Account
                </Text>
                <ArrowRight
                  size={20}
                  color={isFormValid ? "#ffffff" : "#9ca3af"}
                />
              </>
            )}
          </Pressable>

          {/* Login Link */}
          <View className="flex-row items-center justify-center mb-6">
            <Text className="text-sm font-medium text-gray-500">
              Already have an account?
            </Text>
            <Pressable
              onPress={() => router.push("/login")}
              className="ml-2 py-2"
              disabled={loading}
            >
              <Text className="text-sm font-bold text-zinc-900">
                Sign in
              </Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}