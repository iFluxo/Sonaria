import type { AllGuildVoiceChannels } from "seyfert";
import { SonariaError } from "../../struct/SonariaError";
import type { GuildIdResolvable } from "../../type";
import { isSupportedVoiceChannel, resolveGuildId } from "../../util";
import { SonariaVoice } from "../SonariaVoice";
import { GuildIdManager } from "./GuildIdManager";

/**
 * Manages voice connections
 */
export class SonariaVoiceManager extends GuildIdManager<SonariaVoice> {
  /**
   * Create a {@link SonariaVoice} instance
   * @param channel - A voice channel to join
   */
  create(channel: AllGuildVoiceChannels): SonariaVoice {
    if (!isSupportedVoiceChannel(channel)) {
      throw new SonariaError("InvalidType", "BaseGuildVoiceChannel", channel, "channel");
    }
    const existing = this.get(channel.guildId);
    if (existing) {
      existing.channel = channel;
      return existing;
    }
    if (this.client.voice.connections.get(channel.guildId)) {
      throw new SonariaError("VoiceAlreadyCreated");
    }
    return new SonariaVoice(this, channel);
  }
  /**
   * Join a voice channel and wait until the connection is ready
   * @param channel - A voice channel to join
   */
  join(channel: AllGuildVoiceChannels): Promise<SonariaVoice> {
    const existing = this.get(channel.guildId);
    if (existing) return existing.join(channel);
    return this.create(channel).join();
  }
  /**
   * Leave the connected voice channel in a guild
   * @param guild - Guild Resolvable
   */
  leave(guild: GuildIdResolvable) {
    const voice = this.get(guild);
    if (voice) {
      voice.leave();
      return;
    }
    const guildId = resolveGuildId(guild);
    const connection = this.client.voice.connections.get(guildId);
    if (connection && connection.state.status !== "destroyed") {
      void this.client.voice.disconnect(guildId).catch(() => undefined);
    }
  }
}
