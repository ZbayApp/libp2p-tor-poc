import { 
  Message, Type, Field, OneOf
} from 'protobufjs'

export class ChannelMessage extends Message<ChannelMessage> {
  @Field.d(1, "string")
  id: string;

  @Field.d(2, "uint64")
  timestamp: Date;

  @Field.d(3, "bytes")
  content: Buffer;

  @Field.d(4, "string")
  signature: string;
}