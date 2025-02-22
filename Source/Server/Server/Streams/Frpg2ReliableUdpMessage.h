/*
 * Dark Souls 3 - Open Server
 * Copyright (C) 2021 Tim Leonard
 *
 * This program is free software; licensed under the MIT license.
 * You should have received a copy of the license along with this program.
 * If not, see <https://opensource.org/licenses/MIT>.
 */

#pragma once

#include "Shared/Core/Utils/Endian.h"

#include <vector>
#include <memory>

#include "Protobuf/Protobufs.h"

// All the id's of message type we can recieve.
enum class Frpg2ReliableUdpMessageType
{
    Reply = 0x0,
    Push = 0x0320,

#define DEFINE_REQUEST_RESPONSE(OpCode, Type, ProtobufClass, ResponseProtobufClass)         Type = OpCode,
#define DEFINE_MESSAGE(OpCode, Type, ProtobufClass)                                         Type = OpCode,
#define DEFINE_PUSH_MESSAGE(OpCode, Type, ProtobufClass)                                    /* Do Nothing */
#include "Server/Streams/Frpg2ReliableUdpMessageTypes.inc"
#undef DEFINE_PUSH_MESSAGE
#undef DEFINE_MESSAGE
#undef DEFINE_REQUEST_RESPONSE
};

#pragma pack(push, 1)
struct Frpg2ReliableUdpMessageHeader
{
public:
    uint32_t                    header_size     = 0x0C;                                   
    Frpg2ReliableUdpMessageType msg_type        = Frpg2ReliableUdpMessageType::Reply;     // Will be 0 for message replies, the reponse type is derived by matching up the message_index to the request.
    uint32_t                    msg_index       = 0;                                      // Feels like flags. Seen 00 08 10 0A as values.

    void SwapEndian()
    {
        header_size = BigEndianToHostOrder(header_size);
        msg_type    = BigEndianToHostOrder(msg_type);
        msg_index   = LittleEndianToHostOrder(msg_index); // Message index remains in little endian for whatever reason.
    }
};
static_assert(sizeof(Frpg2ReliableUdpMessageHeader) == 12, "Message header is not expected size.");

struct Frpg2ReliableUdpMessageResponseHeader
{
public:
    uint32_t unknown_1 = 0x0;
    uint32_t unknown_2 = 0x1;
    uint32_t unknown_3 = 0x0;
    uint32_t unknown_4 = 0x0;

    void SwapEndian()
    {
    }
};
static_assert(sizeof(Frpg2ReliableUdpMessageResponseHeader) == 16, "Message header is not expected size.");
#pragma pack(pop)


struct Frpg2ReliableUdpMessage
{
public:
    Frpg2ReliableUdpMessageHeader Header;

    // Header only exists if we are a reply message (Header.msg_type == 0).
    Frpg2ReliableUdpMessageResponseHeader ResponseHeader;

    // Gross: This breaks our abstraction, but I can't see any particularly nice
    // way of passing this around so we can send the appropriate DAT/DAT_ACK codes.
    uint32_t AckSequenceIndex = 0;

    std::shared_ptr<google::protobuf::MessageLite> Protobuf;

    std::vector<uint8_t> Payload;

    std::string Disassembly;
};

bool Protobuf_To_ReliableUdpMessageType(google::protobuf::MessageLite* Message, Frpg2ReliableUdpMessageType& Output);
bool ReliableUdpMessageType_To_Protobuf(Frpg2ReliableUdpMessageType Type, bool IsResponse, std::shared_ptr<google::protobuf::MessageLite>& Output);
bool ReliableUdpMessageType_Expects_Response(Frpg2ReliableUdpMessageType Type);
